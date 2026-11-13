ObjC.import('Foundation'); ObjC.import('CoreGraphics');
function run(argv) {
  const self = parseInt(argv[0], 10), out = $.NSFileHandle.fileHandleWithStandardOutput;
  while (true) {
    const list = ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(17, 0))); // OnScreenOnly | ExcludeDesktopElements
    const res = [];
    for (const w of list) {
      if (w.kCGWindowLayer !== 0 || w.kCGWindowOwnerPID === self || !(w.kCGWindowAlpha > 0)) continue;
      const b = w.kCGWindowBounds;
      res.push([w.kCGWindowNumber, b.X, b.Y, b.X + b.Width, b.Y + b.Height]);
    }
    out.writeData($(JSON.stringify(res) + '\n').dataUsingEncoding($.NSUTF8StringEncoding));
    $.NSThread.sleepForTimeInterval(0.15);
  }
}
