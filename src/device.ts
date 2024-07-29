export const isDesktopDevice = (): boolean => {
  const userAgent = navigator.userAgent || navigator.vendor;

  // Detect desktop devices based on the user agent string
  const isDesktop =
    /windows|macintosh|linux/i.test(userAgent) &&
    !/mobile|android|iphone|ipad|tablet/i.test(userAgent);

  return isDesktop;
};
