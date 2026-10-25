export type ShortcutProfile = 'standard' | 'codingBar' | 'quickCode' | 'numbered' | 'selection';
export type ShortcutAction = 'help' | 'feedback' | 'save' | 'newProject' | 'importProject' | 'importSources' | 'find' | 'newCode' | 'newCodeAndApply' | 'codePicker' | 'lastCode' | 'inVivo' | 'annotation' | 'newMemo' | 'journal' | 'memoBook' | 'editDocument' | 'documents' | 'codes' | 'cases' | 'groups' | 'codeMap' | 'analysis' | 'documentMatrix' | 'cooccurrence' | `favorite${number}`;
export const shortcutProfiles: Record<ShortcutProfile,string> = {standard:'Standard',codingBar:'Coding bar',quickCode:'Quick coding',numbered:'Numbered codes',selection:'Selection-first'};
export const shortcutLabels: Record<string,string> = {help:'Open Help',feedback:'Report a problem or suggest a feature',save:'Save current work',newProject:'Create a project',importProject:'Import a project',importSources:'Import document sources',find:'Search document text',newCode:'Create a root code',newCodeAndApply:'Create a code and apply it to the selection',codePicker:'Search codes to apply',lastCode:'Apply the last-used code',inVivo:'Create and apply an in-vivo code',annotation:'Annotate selected text',newMemo:'Create a linked memo',journal:'Create a research journal entry',memoBook:'Open Memo-Book',editDocument:'Edit the current document',documents:'Open Workspace sources',codes:'Open Codebook',cases:'Open Cases',groups:'Open Groups',codeMap:'Open Visualization',analysis:'Open Analysis',documentMatrix:'Open the code × document matrix',cooccurrence:'Open the co-occurrence matrix'};
const common:Record<string,ShortcutAction> = {F1:'help','Mod+Shift+B':'feedback','Mod+S':'save','Mod+N':'newProject','Mod+O':'importProject','Mod+F':'find'};
export const profileBindings:Record<ShortcutProfile,Record<string,ShortcutAction>> = {
 standard:{...common,'Mod+K':'newCode','Mod+J':'codePicker','Mod+Q':'codePicker','Mod+L':'lastCode','Mod+Shift+V':'inVivo','Mod+Shift+A':'annotation','Mod+Shift+K':'newMemo','Mod+Shift+M':'memoBook','Mod+E':'editDocument','Mod+D':'importSources'},
 codingBar:{...common,'Mod+Q':'codePicker','Mod+F2':'codePicker','Mod+F8':'inVivo','Mod+F9':'lastCode','Mod+Shift+A':'annotation','Mod+Shift+K':'newMemo','Mod+Shift+M':'memoBook','Mod+Shift+I':'importSources','Mod+E':'editDocument','Mod+1':'documents','Mod+2':'codes','Mod+3':'cases','Mod+4':'memoBook','Mod+5':'groups','Mod+6':'codeMap','Mod+7':'analysis','Mod+/':'codePicker'},
 quickCode:{...common,'Mod+K':'newCode','Mod+J':'codePicker','Mod+L':'lastCode','Mod+Shift+V':'inVivo'},
 numbered:{...common,'Alt+N':'newCode','Alt+W':'newCodeAndApply','Alt+L':'lastCode','Alt+I':'inVivo','Mod+E':'editDocument','Mod+D':'importSources','Mod+Alt+B':'journal','Mod+Alt+M':'documentMatrix','Mod+Alt+R':'cooccurrence','Mod+Alt+N':'newCode','Mod+Alt+W':'newCodeAndApply','Mod+Alt+L':'lastCode','Mod+Alt+I':'inVivo','Mod+Alt+E':'editDocument'},
 selection:{...common,Space:'codePicker'}
};
export function readShortcutProfile(value:string|null):ShortcutProfile {return value && Object.prototype.hasOwnProperty.call(shortcutProfiles,value)?value as ShortcutProfile:'standard';}
export interface ShortcutKey {key:string;code?:string;ctrlKey:boolean;metaKey:boolean;altKey:boolean;shiftKey:boolean;repeat?:boolean;isComposing?:boolean;getModifierState?:(name:string)=>boolean}
export function resolveShortcut(event:ShortcutKey,profile:ShortcutProfile):ShortcutAction|null {
 if(event.repeat||event.isComposing||event.getModifierState?.('AltGraph'))return null;
 const letter=event.code?.match(/^Key([A-Z])$/)?.[1],digit=event.code?.match(/^Digit([0-9])$/)?.[1];
 const key=letter||digit||(event.key===' '?'Space':event.key.length===1?event.key.toUpperCase():event.key);
 const chord=[event.ctrlKey||event.metaKey?'Mod':'',event.altKey?'Alt':'',event.shiftKey?'Shift':'',key].filter(Boolean).join('+');
 if((profile==='standard'||profile==='numbered') && /^Mod\+[1-9]$/.test(chord))return `favorite${Number(key)}`;
 return profileBindings[profile][chord]||null;
}
