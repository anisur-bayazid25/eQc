export interface FeedbackScreenshot {name:string;base64:string;}
export interface FeedbackReport {
  schemaVersion:1;id:string;kind:'bug'|'feature'|'other';senderName:string;replyTo:string;subject:string;description:string;steps:string;expected:string;
  device?:Record<string,string>;screenshot?:FeedbackScreenshot;
}
export interface FeedbackContext {recipient:string;configured:boolean;device:Record<string,string>;}
export interface FeedbackBridge {
  context:()=>Promise<FeedbackContext>;
  capture:()=>Promise<FeedbackScreenshot>;
  pickScreenshot:()=>Promise<FeedbackScreenshot|null>;
  send:(report:FeedbackReport)=>Promise<{ok:boolean;reportId?:string;error?:string}>;
  save:(report:FeedbackReport)=>Promise<string|null>;
}
