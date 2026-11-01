import type { ReactNode } from 'react';
import { Keyboard, MousePointer2, Printer, ShieldCheck, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/store';
import { Modal } from './ui';

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'Ctrl / ⌘ + Z', action: '撤销上一步' },
  { keys: 'Ctrl / ⌘ + Shift + Z', action: '重做' },
  { keys: 'Delete / Backspace', action: '删除所选画框' },
  { keys: 'Ctrl / ⌘ + D', action: '复制所选画框' },
  { keys: '方向键', action: '微移画框（Shift 加速）' },
  { keys: '空格 + 拖动', action: '平移画布' },
  { keys: '滚轮', action: '取景模式下缩放照片' },
  { keys: 'Ctrl / ⌘ + 0', action: '恢复适应窗口' },
  { keys: 'Esc', action: '退出取景 / 取消选择' },
];

function Block({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-zinc-800">
        <span className="text-indigo-600">{icon}</span>
        {title}
      </div>
      <div className="space-y-1 text-[11px] leading-4 text-zinc-500">{children}</div>
    </div>
  );
}

export function HelpDialog() {
  const open = useAppStore((s) => s.ui.helpOpen);
  const patchUi = useAppStore((s) => s.patchUi);

  return (
    <Modal
      open={open}
      onClose={() => patchUi({ helpOpen: false })}
      title="使用说明"
      subtitle="从上传照片到打印成品的完整流程，以及常用快捷键。"
      width={680}
    >
      <div className="space-y-3 px-5 py-4">
        <Block icon={<Sparkles size={14} />} title="三步完成一页排版">
          <p>1. 在左侧「照片」标签上传图片，或点击「加载示例」快速体验。</p>
          <p>2. 在「纸张」标签选择打印尺寸（A4 / 6 寸相纸 / 明信片 / 证件卡等），也可自定义毫米尺寸。</p>
          <p>3. 在「模板」标签应用自动排版或拼贴模板；照片不足时会自动重复使用图库图片。</p>
        </Block>

        <Block icon={<MousePointer2 size={14} />} title="手动局部调整">
          <p>· 单击画框选中，拖动可移动；拖动四角可缩放；顶部圆形手柄可旋转。</p>
          <p>· 双击画框进入「取景调焦」：拖动照片调整构图，滚轮缩放，Esc 或双击空白退出。</p>
          <p>· 右侧属性检查器可设置构图模式、蒙版形状、圆角、边框、卡纸留白、阴影与图层顺序。</p>
          <p>· 拖动靠近页面边缘或其他画框时会自动吸附；按住 Shift 可暂时关闭吸附。</p>
        </Block>

        <Block icon={<Printer size={14} />} title="导出与打印">
          <p>· PDF：每页尺寸与实际纸张一致（毫米换算），适合照片冲印店或 PDF 打印。</p>
          <p>· PNG / JPEG：按 DPI 输出当前页位图，用于存档或分享。</p>
          <p>· 打印：直接调起系统打印窗口，请选择相同纸张并把缩放设为 100% / 实际尺寸。</p>
          <p>· 「分页海报」把一张照片切到多张纸上，导出全部页面后按顺序拼接。</p>
        </Block>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-zinc-800">
              <Keyboard size={14} className="text-indigo-600" />
              快捷键
            </div>
            <div className="space-y-1">
              {SHORTCUTS.map((item) => (
                <div key={item.keys} className="flex items-baseline justify-between gap-2">
                  <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                    {item.keys}
                  </span>
                  <span className="text-right text-[10.5px] text-zinc-500">{item.action}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Block icon={<ShieldCheck size={14} />} title="隐私与保存">
              <p>· 照片与项目只保存在本机浏览器（IndexedDB / localStorage），不会上传服务器。</p>
              <p>· 关闭页面前项目会自动保存；清除浏览器数据会同时清除本地项目。</p>
              <p>· 大尺寸照片会在内存中生成缩略图，原图仅用于预览与导出。</p>
            </Block>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-[10.5px] leading-4 text-indigo-800">
              <p className="font-semibold">打印建议</p>
              <p className="mt-1">
                照片类输出使用 300 DPI；证件照与明信片建议使用无边距照片纸。
                A4 拼版时可在纸张设置中增大页边距，避免打印机不可打印区域裁掉画面。
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
