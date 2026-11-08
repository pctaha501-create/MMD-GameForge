const ALLOWED = new Set(["project.list_files","project.read_file","project.write_file","project.create_file","scene.save","unreal.detect","unreal.validate_project","unreal.launch"]);
function object(value){return value!==null&&typeof value==="object"&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
function exactKeys(value,keys){return Object.keys(value).every(k=>keys.includes(k))&&keys.every(k=>Object.prototype.hasOwnProperty.call(value,k));}
function relativePath(value){
  if(typeof value!=="string"||!value.trim()||value.length>1024||value.includes("\0")||value.includes("\\"))return false;
  if(value.startsWith("/")||/^[a-zA-Z]:/.test(value))return false;
  return value.split("/").every(part=>part&&part!=="."&&part!=="..");
}
export function validateAIToolCall(value){
  if(!object(value)||!exactKeys(value,["schema_version","tool","arguments"])||value.schema_version!=="mmd.tool-call.v1"||typeof value.tool!=="string"||!ALLOWED.has(value.tool)||!object(value.arguments))return {ok:false,error:"Unsupported or malformed MMD tool call."};
  const a=value.arguments;
  switch(value.tool){
    case "project.list_files":
    case "unreal.detect":
    case "unreal.validate_project":
    case "unreal.launch":
      if(Object.keys(a).length!==0)return {ok:false,error:"This tool does not accept arguments."};
      break;
    case "project.read_file":
      if(!exactKeys(a,["path"])||!relativePath(a.path))return {ok:false,error:"Invalid project-relative file path."};
      break;
    case "project.write_file":
    case "project.create_file":
      if(!exactKeys(a,["path","content"])||!relativePath(a.path)||typeof a.content!=="string"||a.content.length>2*1024*1024)return {ok:false,error:"Invalid file write request or content exceeds 2 MB."};
      break;
    case "scene.save":
      if(!exactKeys(a,["scene_name","content"])||typeof a.scene_name!=="string"||!/^[\p{L}\p{N}_ -]{1,64}$/u.test(a.scene_name.trim())||typeof a.content!=="string"||a.content.length>25*1024*1024)return {ok:false,error:"Invalid scene save request."};
      try{const parsed=JSON.parse(a.content);if(!parsed?.object||parsed.object.type!=="Group"||!Array.isArray(parsed.object.children))return {ok:false,error:"Scene JSON must contain a GameForge Group object."};}
      catch{return {ok:false,error:"Scene content must be valid JSON."};}
      break;
  }
  return {ok:true,value:{schema_version:value.schema_version,tool:value.tool,arguments:a}};
}
