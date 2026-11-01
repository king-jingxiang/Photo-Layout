import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Replace, Sparkles, Upload, X } from 'lucide-react';
import { useActivePage, useAppStore } from '../store/store';
import { EmptyHint } from './ui';

export function PhotoPanel() {
  const photos = useAppStore((s) => s.photos);
  const addPhotos = useAppStore((s) => s.addPhotos);
  const addSamples = useAppStore((s) => s.addSamples);
  const addPhotoToPage = useAppStore((s) => s.addPhotoToPage);
  const replaceFramePhoto = useAppStore((s) => s.replaceFramePhoto);
  const removePhoto = useAppStore((s) => s.removePhoto);
  const busy = useAppStore((s) => s.busy);
  const selectedFrameId = useAppStore((s) => s.ui.selectedFrameId);
  const page = useActivePage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    await addPhotos(Array.from(files));
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto scroll-thin px-3 pb-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <div
        className={`mt-3 rounded-xl border border-dashed p-3 transition-colors ${
          dragOver
            ? 'border-indigo-400 bg-indigo-50/70'
            : 'border-zinc-300 bg-zinc-50/70 hover:border-zinc-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <button
          type="button"
          onClick={openPicker}
          disabled={!!busy}
          className="flex w-full flex-col items-center gap-1.5 py-2 text-center disabled:opacity-60"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-indigo-600 shadow-sm ring-1 ring-zinc-200">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          </span>
          <span className="text-[13px] font-medium text-zinc-800">拖拽或点击上传照片</span>
          <span className="text-[10.5px] text-zinc-400">JPG · PNG · WebP · 支持多选</span>
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
        <span>
          图库 <span className="font-medium text-zinc-600">{photos.length}</span> 张
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
          onClick={() => void addSamples()}
          disabled={!!busy}
        >
          <Sparkles size={12} />
          加载示例
        </button>
      </div>

      {photos.length === 0 ? (
        <div className="mt-3">
          <EmptyHint
            icon={<ImagePlus size={26} strokeWidth={1.6} />}
            title="还没有照片"
            description="上传照片后，可用自动排版或内置模板快速完成一页作品。所有处理都在本机完成。"
            action={
              <button type="button" className="btn btn-soft h-8 text-[12px]" onClick={() => void addSamples()}>
                <Sparkles size={13} /> 先加载示例照片体验
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {photos.map((photo) => (
            <article
              key={photo.id}
              className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:border-indigo-300 hover:shadow-sm"
            >
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => addPhotoToPage(photo.id)}
                title="添加到当前页面"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
                  <img
                    src={photo.thumb}
                    alt={photo.name}
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-900/25 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-white/85 px-1.5 py-0.5 text-[9.5px] font-medium text-zinc-700 opacity-0 backdrop-blur transition group-hover:opacity-100">
                    点击添加到版面
                  </span>
                </div>
                <div className="px-2 py-1.5">
                  <p className="truncate text-[11.5px] font-medium text-zinc-700" title={photo.name}>
                    {photo.name}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    {photo.width} × {photo.height}
                  </p>
                </div>
              </button>

              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                {selectedFrameId ? (
                  <button
                    type="button"
                    className="grid h-6 w-6 place-items-center rounded-md bg-white/90 text-zinc-600 shadow-sm backdrop-blur hover:text-indigo-600"
                    title="替换所选画框中的照片"
                    onClick={() => replaceFramePhoto(selectedFrameId, photo.id)}
                  >
                    <Replace size={12} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="grid h-6 w-6 place-items-center rounded-md bg-white/90 text-zinc-600 shadow-sm backdrop-blur hover:text-red-600"
                  title="从图库移除"
                  onClick={() => void removePhoto(photo.id)}
                >
                  <X size={12} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-lg bg-zinc-50 p-2.5 text-[10.5px] leading-4 text-zinc-400">
        提示：点击照片添加到页面；选中画框后，点击照片右上角的
        <span className="mx-1 inline-flex align-middle text-zinc-500">
          <Replace size={11} />
        </span>
        可替换照片。当前页共 {page.items.length} 个画框。
      </div>
    </div>
  );
}
