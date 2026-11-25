import Foundation
import Vision
import CoreImage
import AppKit

// 用 macOS Vision 的前景遮罩把人物從背景取出，輸出透明 PNG。
// 用法：swift vision-cutout.swift <輸入圖> <輸出前綴> [--instances]
let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: vision-cutout <in> <outPrefix> [--instances]"); exit(1) }
let inURL = URL(fileURLWithPath: args[1])
let prefix = args[2]
let splitInstances = args.contains("--instances")

guard let src = CIImage(contentsOf: inURL) else { print("讀不到圖片"); exit(1) }
let handler = VNImageRequestHandler(ciImage: src, options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()
do { try handler.perform([request]) } catch { print("Vision 失敗：\(error)"); exit(2) }
guard let result = request.results?.first else { print("沒有前景結果"); exit(3) }

let ctx = CIContext()
let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
let clear = CIImage(color: .clear).cropped(to: src.extent)

func write(_ image: CIImage, _ path: String) {
  do { try ctx.writePNGRepresentation(of: image, to: URL(fileURLWithPath: path), format: .RGBA8, colorSpace: srgb) }
  catch { print("寫檔失敗：\(error)"); exit(4) }
}

if splitInstances {
  let all = result.allInstances
  print("instances=\(all.count)")
  var i = 0
  for inst in all {
    let mask = try result.generateScaledMaskForImage(forInstances: [inst], from: handler)
    let maskCI = CIImage(cvPixelBuffer: mask)
    let blend = CIFilter(name: "CIBlendWithMask", parameters: [
      kCIInputImageKey: src, kCIInputBackgroundImageKey: clear, kCIInputMaskImageKey: maskCI])!.outputImage!
    // 用遮罩的實際範圍裁切，方便算 source 座標
    let extent = maskCI.extent
    let crop = blend.cropped(to: extent)
    write(crop, "\(prefix)-\(i).png")
    print("instance \(i): bbox=\(Int(extent.origin.x)),\(Int(extent.origin.y)) \(Int(extent.width))x\(Int(extent.height))")
    i += 1
  }
} else {
  let mask = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
  let maskCI = CIImage(cvPixelBuffer: mask)
  let blend = CIFilter(name: "CIBlendWithMask", parameters: [
    kCIInputImageKey: src, kCIInputBackgroundImageKey: clear, kCIInputMaskImageKey: maskCI])!.outputImage!
  write(blend, "\(prefix).png")
  print("輸出 \(prefix).png")
}
