#import <CoreGraphics/CoreGraphics.h>
#import <AppKit/AppKit.h>

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc != 2) {
      fprintf(stderr, "Usage: window-audit <pid>\n");
      return 2;
    }
    pid_t target = (pid_t)strtol(argv[1], NULL, 10);
    CFArrayRef copied = CGWindowListCopyWindowInfo(
      kCGWindowListOptionAll,
      kCGNullWindowID);
    NSArray *windows = CFBridgingRelease(copied);
    NSMutableArray *matched = [NSMutableArray array];
    for (NSDictionary *window in windows) {
      if ([window[(id)kCGWindowOwnerPID] intValue] != target) continue;
      [matched addObject:@{
        @"windowNumber": window[(id)kCGWindowNumber] ?: @0,
        @"name": window[(id)kCGWindowName] ?: @"",
        @"onscreen": window[(id)kCGWindowIsOnscreen] ?: @NO,
        @"alpha": window[(id)kCGWindowAlpha] ?: @0,
        @"layer": window[(id)kCGWindowLayer] ?: @0,
        @"bounds": window[(id)kCGWindowBounds] ?: @{},
      }];
    }
    NSDictionary *result = @{
      @"schema": @"cssmars-google-earth-pro-window-audit@1",
      @"pid": @(target),
      @"windows": matched,
      @"visibleWindowCount": @([matched filteredArrayUsingPredicate:
        [NSPredicate predicateWithBlock:^BOOL(NSDictionary *window,
                                               __unused NSDictionary *bindings) {
          return [window[@"onscreen"] boolValue] &&
            [window[@"alpha"] doubleValue] > 0;
        }]].count),
      @"frontmostApplication": @{
        @"name": [NSWorkspace sharedWorkspace]
          .frontmostApplication.localizedName ?: @"",
        @"pid": @([NSWorkspace sharedWorkspace]
          .frontmostApplication.processIdentifier),
        @"bundleIdentifier": [NSWorkspace sharedWorkspace]
          .frontmostApplication.bundleIdentifier ?: @"",
      },
    };
    NSData *json = [NSJSONSerialization dataWithJSONObject:result
                                                   options:NSJSONWritingPrettyPrinted
                                                     error:nil];
    fwrite(json.bytes, 1, json.length, stdout);
    fputc('\n', stdout);
  }
  return 0;
}
