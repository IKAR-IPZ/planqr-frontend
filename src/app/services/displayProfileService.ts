export interface TabletDisplayProfilePayload {
  viewportWidthPx: number;
  viewportHeightPx: number;
  screenWidthPx: number;
  screenHeightPx: number;
  devicePixelRatio: number;
  screenOrientation: string;
}

const getScreenOrientation = () => {
  const orientationType = window.screen.orientation?.type;
  if (orientationType) {
    return orientationType;
  }

  return window.innerWidth >= window.innerHeight ? "landscape-primary" : "portrait-primary";
};

export const readTabletDisplayProfile = (): TabletDisplayProfilePayload | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const viewportWidthPx = Math.round(window.innerWidth);
  const viewportHeightPx = Math.round(window.innerHeight);
  const screenWidthPx = Math.round(window.screen.width);
  const screenHeightPx = Math.round(window.screen.height);
  const devicePixelRatio = Number(window.devicePixelRatio || 1);

  if (
    viewportWidthPx <= 0 ||
    viewportHeightPx <= 0 ||
    screenWidthPx <= 0 ||
    screenHeightPx <= 0 ||
    !Number.isFinite(devicePixelRatio) ||
    devicePixelRatio <= 0
  ) {
    return null;
  }

  return {
    viewportWidthPx,
    viewportHeightPx,
    screenWidthPx,
    screenHeightPx,
    devicePixelRatio,
    screenOrientation: getScreenOrientation(),
  };
};

export const reportTabletDisplayProfile = async (deviceId: string) => {
  const profile = readTabletDisplayProfile();
  if (!profile) {
    return false;
  }

  const response = await fetch("/api/registry/display-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId,
      ...profile,
    }),
  });

  return response.ok;
};
