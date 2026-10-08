import { OriginalSource } from '../domain';

export async function hashSourceText(content: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

export async function retainOriginalFile(file: File, content: string): Promise<OriginalSource> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Chunk conversion avoids spreading a large PDF into one call's argument list.
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return { name: file.name, format: /\.docx$/i.test(file.name) ? 'docx' : 'pdf', base64: btoa(binary), textHash: await hashSourceText(content) };
}
