const test=require("node:test");
const assert=require("node:assert/strict");
let validateAIToolCall;
test.before(async()=>{({validateAIToolCall}=await import("../src/shared/ai-tool-call.mjs"));});
test("accepts only allowlisted read-only project tools",()=>{
 const r=validateAIToolCall({schema_version:"mmd.tool-call.v1",tool:"project.read_file",arguments:{path:"Source/Game.cpp"}});
 assert.equal(r.ok,true);
});
test("rejects traversal and absolute paths",()=>{
 for(const path of ["../secret.txt","C:/secret.txt","/etc/passwd","folder\\secret.txt"])
  assert.equal(validateAIToolCall({schema_version:"mmd.tool-call.v1",tool:"project.read_file",arguments:{path}}).ok,false);
});
test("rejects arbitrary shell or unknown tools",()=>{
 assert.equal(validateAIToolCall({schema_version:"mmd.tool-call.v1",tool:"shell.exec",arguments:{command:"whoami"}}).ok,false);
});
test("requires exact bounded write arguments",()=>{
 assert.equal(validateAIToolCall({schema_version:"mmd.tool-call.v1",tool:"project.write_file",arguments:{path:"Source/main.cpp",content:"ok"}}).ok,true);
 assert.equal(validateAIToolCall({schema_version:"mmd.tool-call.v1",tool:"project.write_file",arguments:{path:"Source/main.cpp",content:"x".repeat(2*1024*1024+1)}}).ok,false);
});
test("validates scene structure before offering save",()=>{
 const good=JSON.stringify({object:{type:"Group",children:[]}});
 assert.equal(validateAIToolCall({schema_version:"mmd.tool-call.v1",tool:"scene.save",arguments:{scene_name:"Level One",content:good}}).ok,true);
 assert.equal(validateAIToolCall({schema_version:"mmd.tool-call.v1",tool:"scene.save",arguments:{scene_name:"Level One",content:"{}"}}).ok,false);
});
test("accepts safe new project file creation",()=>{
 assert.equal(validateAIToolCall({schema_version:"mmd.tool-call.v1",tool:"project.create_file",arguments:{path:"Source/NewActor.cpp",content:"// new file"}}).ok,true);
});

test("accepts Unreal project validation without arguments",()=>{
 assert.equal(validateAIToolCall({schema_version:"mmd.tool-call.v1",tool:"unreal.validate_project",arguments:{}}).ok,true);
});

test("accepts a constrained Unreal project creation request",()=>{
 assert.equal(validateAIToolCall({schema_version:"mmd.tool-call.v1",tool:"unreal.create_project",arguments:{project_name:"MyGame"}}).ok,true);
 assert.equal(validateAIToolCall({schema_version:"mmd.tool-call.v1",tool:"unreal.create_project",arguments:{project_name:"../escape"}}).ok,false);
});
