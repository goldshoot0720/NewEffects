#!/usr/bin/env python3
"""以 macOS Vision 的前景遮罩（VNGenerateForegroundInstanceMaskRequest）把單張人物圖去背。
用法：python3 tools/matte-vision.py <輸入圖> <輸出-matte.png>
輸出為灰階 PNG：255 = 前景、0 = 背景。只在 macOS 14+ 可用，僅供本機切圖前處理。"""
import sys
import Vision, Quartz
from Foundation import NSURL, CFURLCreateWithFileSystemPath, kCFURLPOSIXPathStyle


def matte(src, dst):
    url = NSURL.fileURLWithPath_(src)
    handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(url, None)
    req = Vision.VNGenerateForegroundInstanceMaskRequest.alloc().init()
    ok, err = handler.performRequests_error_([req], None)
    if not ok:
        raise RuntimeError(f'Vision 失敗：{err}')
    results = list(req.results() or [])
    if not results:
        raise RuntimeError('Vision 找不到前景實例')
    obs = results[0]
    instances = obs.allInstances()
    print(f'  {src}: {len(instances)} 個前景實例')
    buf, err = obs.generateScaledMaskForImageForInstances_fromRequestHandler_error_(
        instances, handler, None)
    if buf is None:
        raise RuntimeError(f'遮罩產生失敗：{err}')

    # 交給 CoreImage 轉成 CGImage，避免手動處理 CVPixelBuffer 的 stride
    ci = Quartz.CIImage.imageWithCVPixelBuffer_(buf)
    ctx = Quartz.CIContext.contextWithOptions_({Quartz.kCIContextWorkingColorSpace: None})
    ext = ci.extent()
    cg = ctx.createCGImage_fromRect_(ci, ext)
    if cg is None:
        raise RuntimeError('CGImage 轉換失敗')

    cfurl = CFURLCreateWithFileSystemPath(None, dst, kCFURLPOSIXPathStyle, False)
    dest = Quartz.CGImageDestinationCreateWithURL(cfurl, 'public.png', 1, None)
    if dest is None:
        raise RuntimeError('無法建立輸出檔')
    Quartz.CGImageDestinationAddImage(dest, cg, None)
    if not Quartz.CGImageDestinationFinalize(dest):
        raise RuntimeError('PNG 寫入失敗')
    print(f'  -> {dst} ({int(ext.size.width)}x{int(ext.size.height)})')


if __name__ == '__main__':
    matte(sys.argv[1], sys.argv[2])
