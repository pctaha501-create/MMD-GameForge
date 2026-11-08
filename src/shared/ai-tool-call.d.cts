export interface AIToolCall { schema_version:"mmd.tool-call.v1"; tool:"project.list_files"|"project.read_file"|"project.write_file"|"project.create_file"|"scene.save"|"unreal.detect"|"unreal.launch"; arguments:Record<string,unknown>; }
export function validateAIToolCall(value:unknown):{ok:true;value:AIToolCall}|{ok:false;error:string};
