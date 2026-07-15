import { useMemo, useState } from 'react'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import {
  AccessibilityHelp,
  Alignment,
  Autoformat,
  AutoImage,
  AutoLink,
  BalloonToolbar,
  BlockQuote,
  Bold,
  Bookmark,
  ClassicEditor,
  Code,
  CodeBlock,
  Essentials,
  FindAndReplace,
  FontBackgroundColor,
  FontColor,
  FontFamily,
  FontSize,
  Fullscreen,
  GeneralHtmlSupport,
  Heading,
  Highlight,
  HorizontalLine,
  HtmlEmbed,
  Image,
  ImageBlock,
  ImageCaption,
  ImageInline,
  ImageInsert,
  ImageInsertViaUrl,
  ImageResize,
  ImageStyle,
  ImageTextAlternative,
  ImageToolbar,
  ImageUpload,
  Indent,
  IndentBlock,
  Italic,
  Link,
  LinkImage,
  List,
  ListProperties,
  MediaEmbed,
  PageBreak,
  Paragraph,
  PasteFromOffice,
  RemoveFormat,
  SelectAll,
  ShowBlocks,
  SourceEditing,
  SpecialCharacters,
  SpecialCharactersEssentials,
  Strikethrough,
  Style,
  Subscript,
  Superscript,
  Table,
  TableCaption,
  TableCellProperties,
  TableColumnResize,
  TableProperties,
  TableToolbar,
  TextTransformation,
  TodoList,
  Underline,
  Undo,
  WordCount,
} from 'ckeditor5'
import 'ckeditor5/ckeditor5.css'
import { uploadAdminContentImage } from '../lib/api'

const contentEditorPlugins = [
  AccessibilityHelp, Alignment, Autoformat, AutoImage, AutoLink, BalloonToolbar,
  BlockQuote, Bold, Bookmark, Code, CodeBlock, Essentials, FindAndReplace,
  FontBackgroundColor, FontColor, FontFamily, FontSize, Fullscreen,
  GeneralHtmlSupport, Heading, Highlight, HorizontalLine, HtmlEmbed, Image,
  ImageBlock, ImageCaption, ImageInline, ImageInsert, ImageInsertViaUrl,
  ImageResize, ImageStyle, ImageTextAlternative, ImageToolbar, ImageUpload,
  Indent, IndentBlock, Italic, Link, LinkImage, List, ListProperties, MediaEmbed,
  PageBreak, Paragraph, PasteFromOffice, RemoveFormat, SelectAll, ShowBlocks,
  SourceEditing, SpecialCharacters, SpecialCharactersEssentials, Strikethrough,
  Style, Subscript, Superscript, Table, TableCaption, TableCellProperties,
  TableColumnResize, TableProperties, TableToolbar, TextTransformation, TodoList,
  Underline, Undo, WordCount,
]

class ContentImageUploadAdapter {
  constructor(loader) {
    this.loader = loader
    this.controller = new AbortController()
  }

  async upload() {
    const file = await this.loader.file
    const payload = await uploadAdminContentImage(file, this.controller.signal)
    return { default: payload.url }
  }

  abort() {
    this.controller.abort()
  }
}

function ContentImageUploadPlugin(editor) {
  editor.plugins.get('FileRepository').createUploadAdapter = (loader) => new ContentImageUploadAdapter(loader)
}

export function ContentRichEditor({ data, language, onChange }) {
  const [stats, setStats] = useState({ words: 0, characters: 0 })
  const [editorError, setEditorError] = useState('')
  const editorConfig = useMemo(() => ({
    licenseKey: import.meta.env.VITE_CKEDITOR_LICENSE_KEY || 'GPL',
    plugins: contentEditorPlugins,
    extraPlugins: [ContentImageUploadPlugin],
    menuBar: { isVisible: true },
    toolbar: {
      shouldNotGroupWhenFull: true,
      items: [
        'undo', 'redo', '|', 'findAndReplace', 'selectAll', '|',
        'heading', 'style', '|', 'fontSize', 'fontFamily', 'fontColor',
        'fontBackgroundColor', 'highlight', '|', 'bold', 'italic', 'underline',
        'strikethrough', 'subscript', 'superscript', 'code', 'removeFormat', '|',
        'alignment', '|', 'link', 'bookmark', 'insertImage', 'mediaEmbed',
        'insertTable', 'blockQuote', 'codeBlock', 'htmlEmbed', 'horizontalLine',
        'pageBreak', 'specialCharacters', '|', 'bulletedList', 'numberedList',
        'todoList', 'outdent', 'indent', '|', 'showBlocks', 'sourceEditing',
        'fullscreen', 'accessibilityHelp',
      ],
    },
    balloonToolbar: ['bold', 'italic', 'link', '|', 'bulletedList', 'numberedList'],
    heading: {
      options: [
        { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
        { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
        { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
        { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
        { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
      ],
    },
    fontFamily: { supportAllValues: true },
    fontSize: { options: [9, 10, 11, 12, 14, 'default', 18, 20, 24, 28, 32, 36, 48], supportAllValues: true },
    image: {
      toolbar: ['imageTextAlternative', 'toggleImageCaption', '|', 'imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|', 'resizeImage'],
      insert: { integrations: ['upload', 'url'] },
    },
    table: {
      contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', '|', 'tableProperties', 'tableCellProperties', '|', 'toggleTableCaption'],
    },
    list: { properties: { styles: true, startIndex: true, reversed: true } },
    link: {
      addTargetToExternalLinks: true,
      defaultProtocol: 'https://',
      decorators: {
        downloadable: { mode: 'manual', label: 'Downloadable', attributes: { download: 'download' } },
      },
    },
    style: {
      definitions: [
        { name: 'Lead paragraph', element: 'p', classes: ['article-lead'] },
        { name: 'Information callout', element: 'div', classes: ['article-callout'] },
        { name: 'Scientific note', element: 'div', classes: ['article-science-note'] },
      ],
    },
    htmlSupport: {
      allow: [{
        name: /.*/,
        attributes: ['id', 'title', 'target', 'rel', 'href', 'src', 'alt', 'width', 'height', /^data-[\w-]+$/],
        classes: true,
        styles: true,
      }],
      disallow: [
        { name: /^(script|iframe|object|embed)$/ },
        { attributes: [/^on/i] },
      ],
    },
    htmlEmbed: { showPreviews: false },
    wordCount: { onUpdate: ({ words, characters }) => setStats({ words, characters }) },
    language: { content: language === 'th' ? 'th' : 'en', ui: 'en' },
    placeholder: language === 'th' ? 'เริ่มเขียนเนื้อหาความรู้ที่นี่…' : 'Start writing the learning content here…',
  }), [language])

  return (
    <div className="admin-rich-editor">
      {editorError && <div className="admin-rich-editor__error" role="alert">{editorError}</div>}
      <CKEditor
        editor={ClassicEditor}
        config={editorConfig}
        data={data}
        onChange={(_event, editor) => {
          setEditorError('')
          onChange(editor.getData())
        }}
        onError={(error, details) => {
          if (!details?.willEditorRestart) setEditorError(error?.message || 'The visual editor could not continue.')
        }}
      />
      <footer className="admin-rich-editor__status"><span>CKEditor 5 · HTML output</span><span>{stats.words.toLocaleString()} words · {stats.characters.toLocaleString()} characters</span></footer>
    </div>
  )
}
