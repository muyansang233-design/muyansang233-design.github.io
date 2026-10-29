"""Normalize the read-only UAssetAPI export and preserve graph provenance.
Input .raw.json files are exported by UAssetAPI at b4e8a012939295a6fd890ddc64e57ea78b709b95.
See source-notes.txt for the three native material-input parser corrections used.
"""
from pathlib import Path
import json, hashlib
ROOT=Path(__file__).resolve().parent

def clean(p):
    if not isinstance(p,dict):
        if isinstance(p,list): return [clean(v) for v in p]
        return 0.0 if p in ('+0','-0') else p
    if 'EnumValue' in p: return p['EnumValue']
    if 'Expression' in p:
        return {k:clean(p[k]) for k in ['Expression','OutputIndex','InputName','Mask','MaskR','MaskG','MaskB','MaskA'] if k in p}
    if 'ArrayType' in p: return [clean(v) for v in p.get('Value',[])]
    if 'Value' in p:
        v=p['Value']
        if isinstance(v,list) and all(isinstance(x,dict) and 'Name' in x for x in v):
            if len(v)==1 and v[0]['Name']==p.get('Name'): return clean(v[0])
            return properties(v)
        return clean(v)
    return {k:clean(v) for k,v in p.items() if k!='$type'}

def properties(ps):
    out={}
    for p in ps:
        name=p['Name']
        if p.get('ArrayIndex',0): name+='['+str(p['ArrayIndex'])+']'
        out[name]=clean(p)
    return out

assets={}
for name in ['M_Water','M_Water_Inst']:
    raw=json.loads((ROOT/(name+'.raw.json')).read_text())
    def ref(i):
        if i<0:
            x=raw['Imports'][-i-1]; parent=x['OuterIndex']
            return (ref(parent)+'.' if parent else '')+x['ObjectName']
        return raw['Exports'][i-1]['ObjectName'] if i>0 else None
    exports=[]
    for i,e in enumerate(raw['Exports'],1):
        assert isinstance(e.get('Data'),list),(i,e['ObjectName'],'unparsed export')
        exports.append({'id':i,'name':e['ObjectName'],'type':ref(e['ClassIndex']),'properties':properties(e['Data']),'offset':e['SerialOffset'],'size':e['SerialSize']})
    assets[name]={'exports':exports,'imports':[{'id':-i,'path':ref(-i)} for i in range(1,len(raw['Imports'])+1)]}
    (ROOT/(name+'.normalized.json')).write_text(json.dumps(assets[name],ensure_ascii=False,indent=2)+'\n')

material=assets['M_Water']; instance=assets['M_Water_Inst']['exports'][0]['properties']
scalar_overrides={p['ParameterInfo']['Name']:p['ParameterValue'] for p in instance['ScalarParameterValues']}
vector_overrides={p['ParameterInfo']['Name']:p['ParameterValue'] for p in instance['VectorParameterValues']}
params=[]
for e in material['exports']:
    p=e['properties']; t=e['type'].split('.')[-1]
    if t in ['MaterialExpressionScalarParameter','MaterialExpressionVectorParameter','MaterialExpressionStaticBoolParameter']:
        name=p.get('ParameterName','Param'); default=p.get('DefaultValue',False if 'StaticBool' in t else 0.0)
        override=(vector_overrides if 'Vector' in t else scalar_overrides).get(name)
        params.append({'name':name,'group':p.get('Group',''),'default':default,'value':default if override is None else override,'overridden':override is not None,'kind':t.replace('MaterialExpression',''),'nodeId':e['id']})

outputs={k:v for k,v in material['exports'][1]['properties'].items() if isinstance(v,dict) and 'Expression' in v}
nodes={e['id']:e for e in material['exports']}
def deps(v):
    if isinstance(v,dict):
        if 'Expression' in v and v['Expression']>0: yield v['Expression']
        for x in v.values(): yield from deps(x)
    if isinstance(v,list):
        for x in v: yield from deps(x)
def walk(i,seen):
    if i in seen or i<=0:return
    seen.add(i);e=nodes[i];p=e['properties'];typ=e['type'].split('.')[-1]
    if typ=='MaterialExpressionNamedRerouteUsage': walk(p['Declaration'],seen)
    elif typ=='MaterialExpressionLinearInterpolate' and 'Alpha' in p:
        alpha=nodes[p['Alpha']['Expression']];a=alpha['properties']
        # Resolve the static UseCurtainMask switches: false -> Const 0 -> lerp A only.
        if alpha['type'].endswith('MaterialExpressionStaticSwitch') and nodes[a['Value']['Expression']]['properties'].get('ParameterName')=='UseCurtainMask':
            walk(p['A']['Expression'],seen);walk(p['Alpha']['Expression'],seen)
        else:
            for j in deps(p): walk(j,seen)
    elif typ=='MaterialExpressionStaticSwitch':
        v=nodes[p['Value']['Expression']]['properties'].get('DefaultValue',False)
        walk(p['A' if v else 'B']['Expression'],seen);walk(p['Value']['Expression'],seen)
    else:
        for j in deps(p): walk(j,seen)
active=set()
for v in outputs.values():walk(v['Expression'],active)
for p in params:p['activeInWaterBall']=p['nodeId'] in active
textures=[]
imports={x['id']:x['path'] for x in material['imports']}
for e in material['exports']:
    p=e['properties']
    if 'Texture' in p:textures.append({'nodeId':e['id'],'name':e['name'],'asset':imports[p['Texture']],'activeInWaterBall':e['id'] in active,'sampler':p.get('SamplerType','SAMPLERTYPE_Color'),'coordinates':p.get('Coordinates')})
summary={'schemaVersion':1,'source':{'project':'WaterBall.uproject','engine':'5.8','material':'Content/M_Water.uasset','instance':'Content/M_Water_Inst.uasset','materialSHA256':hashlib.sha256(Path('/Users/muyan/Downloads/WaterBall/Content/M_Water.uasset').read_bytes()).hexdigest(),'parser':'UAssetAPI b4e8a012939295a6fd890ddc64e57ea78b709b95, native material input corrections; no source assets modified'},'blendMode':'BLEND_Translucent','shadingModel':'MSM_Unlit','refractionMethod':'RM_IndexOfRefraction','outputs':outputs,'parameters':params,'scalarOverrides':scalar_overrides,'vectorOverrides':vector_overrides,'textures':textures,'activeNodeIds':sorted(active),'customWaterCurtainEnabled':False,'notes':['The seven website stages are semantic material branches, not seven GPU rendering passes.','The UE 5.8 source assets are authoritative; Saved/ShaderDebugInfo contains an older compiled material version.','UseCurtainMask defaults to false and M_Water_Inst has no static overrides. The Custom SDF water-curtain branch is therefore excluded from this water-ball reconstruction.','The Unreal scene cubemap is a runtime CubeRenderTarget. Browser lighting and scene refraction require an explicitly identified replacement environment.','MaterialExpressionLinearInterpolate_6 (id 90) has no Alpha connection or stored ConstAlpha; the UE node default 0.5 blends mask and IOR.','Web mesh scale and sphere UVs, render-target contents, scene lighting, translucent sorting and engine post-processing can prevent pixel-identical output.']}
(ROOT/'material-analysis.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
(ROOT/'instance-parameters.json').write_text(json.dumps(scalar_overrides,ensure_ascii=False,indent=2)+'\n')
(ROOT/'effective-parameters.json').write_text(json.dumps({p['name']:p['value'] for p in params if p['activeInWaterBall']},ensure_ascii=False,indent=2)+'\n')
(ROOT/'water-curtain-original.hlsl').write_text(nodes[74]['properties']['Code'])
print('All exports parsed:',len(nodes),'Active nodes:',len(active),'Active parameters:',sum(p['activeInWaterBall'] for p in params))
print('Output connections:',{k:v['Expression'] for k,v in outputs.items() if v['Expression']})
