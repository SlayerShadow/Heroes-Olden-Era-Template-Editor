export {}

declare global {
  interface OePickerAcceptType {
    description?: string
    accept: Record<string, string[]>
  }

  interface OeOpenFilePickerOptions {
    multiple?: boolean
    types?: OePickerAcceptType[]
    excludeAcceptAllOption?: boolean
  }

  interface OeDirectoryPickerOptions {
    id?: string
    mode?: 'read' | 'readwrite'
  }

  interface Window {
    showOpenFilePicker(options?: OeOpenFilePickerOptions): Promise<FileSystemFileHandle[]>
    showDirectoryPicker(options?: OeDirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
  }
}