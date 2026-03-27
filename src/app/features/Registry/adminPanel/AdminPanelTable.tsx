import { useEffect, useRef, type ReactNode } from "react";

const MOBILE_TABLE_SCROLL_BREAKPOINT_PX = 720;
const TOUCH_SCROLL_LOCK_THRESHOLD_PX = 8;
const TOUCH_MOMENTUM_MIN_VELOCITY_PX_PER_MS = 0.18;
const TOUCH_MOMENTUM_STOP_VELOCITY_PX_PER_MS = 0.02;
const TOUCH_MOMENTUM_DECAY_TIME_MS = 220;

interface AdminPanelTableProps {
  caption: string;
  columns: ReactNode[];
  className?: string;
  wrapperClassName?: string;
  columnGroup?: ReactNode;
  children: ReactNode;
}

const AdminPanelTable = ({
  caption,
  columns,
  className,
  wrapperClassName,
  columnGroup,
  children,
}: AdminPanelTableProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof window === "undefined") {
      return;
    }

    let touchActive = false;
    let lockDirection: "x" | "y" | null = null;
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastTimestamp = 0;
    let velocityY = 0;
    let momentumVelocityY = 0;
    let momentumFrameId = 0;
    let momentumTimestamp = 0;

    const getScrollingElement = () => document.scrollingElement;

    const shouldProxyVerticalScroll = () =>
      window.innerWidth <= MOBILE_TABLE_SCROLL_BREAKPOINT_PX &&
      wrapper.scrollWidth > wrapper.clientWidth &&
      getScrollingElement() !== null;

    const stopMomentum = () => {
      if (momentumFrameId !== 0) {
        window.cancelAnimationFrame(momentumFrameId);
        momentumFrameId = 0;
      }

      momentumTimestamp = 0;
      momentumVelocityY = 0;
    };

    const stepMomentum = (timestamp: number) => {
      const scrollingElement = getScrollingElement();
      if (!scrollingElement) {
        stopMomentum();
        return;
      }

      if (momentumTimestamp === 0) {
        momentumTimestamp = timestamp;
      }

      const deltaMs = Math.min(34, timestamp - momentumTimestamp);
      momentumTimestamp = timestamp;

      if (deltaMs <= 0) {
        momentumFrameId = window.requestAnimationFrame(stepMomentum);
        return;
      }

      const maxScrollTop = scrollingElement.scrollHeight - scrollingElement.clientHeight;
      const nextScrollTop = scrollingElement.scrollTop - momentumVelocityY * deltaMs;
      const clampedScrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop));

      if (clampedScrollTop === scrollingElement.scrollTop) {
        stopMomentum();
        return;
      }

      scrollingElement.scrollTop = clampedScrollTop;
      momentumVelocityY *= Math.exp(-deltaMs / TOUCH_MOMENTUM_DECAY_TIME_MS);

      if (Math.abs(momentumVelocityY) < TOUCH_MOMENTUM_STOP_VELOCITY_PX_PER_MS) {
        stopMomentum();
        return;
      }

      momentumFrameId = window.requestAnimationFrame(stepMomentum);
    };

    const resetTouchState = () => {
      touchActive = false;
      lockDirection = null;
      velocityY = 0;
      lastTimestamp = 0;
    };

    const handleTouchStart = (event: TouchEvent) => {
      stopMomentum();

      if (event.touches.length !== 1 || !shouldProxyVerticalScroll()) {
        resetTouchState();
        return;
      }

      const touch = event.touches[0];
      touchActive = true;
      lockDirection = null;
      startX = touch.clientX;
      startY = touch.clientY;
      lastY = touch.clientY;
      lastTimestamp = event.timeStamp;
      velocityY = 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!touchActive || event.touches.length !== 1 || !shouldProxyVerticalScroll()) {
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (lockDirection === null) {
        if (
          Math.abs(deltaX) < TOUCH_SCROLL_LOCK_THRESHOLD_PX &&
          Math.abs(deltaY) < TOUCH_SCROLL_LOCK_THRESHOLD_PX
        ) {
          return;
        }

        lockDirection = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      }

      const deltaSinceLastMoveY = touch.clientY - lastY;
      const deltaTimeMs = Math.max(1, event.timeStamp - lastTimestamp);
      lastY = touch.clientY;
      lastTimestamp = event.timeStamp;

      if (lockDirection !== "y") {
        return;
      }

      const scrollingElement = getScrollingElement();
      if (!scrollingElement) {
        return;
      }

      event.preventDefault();

      const maxScrollTop = scrollingElement.scrollHeight - scrollingElement.clientHeight;
      const nextScrollTop = scrollingElement.scrollTop - deltaSinceLastMoveY;
      const clampedScrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop));
      const appliedDelta = scrollingElement.scrollTop - clampedScrollTop;
      scrollingElement.scrollTop = clampedScrollTop;

      const currentVelocityY = appliedDelta / deltaTimeMs;
      velocityY =
        velocityY === 0
          ? currentVelocityY
          : velocityY * 0.35 + currentVelocityY * 0.65;
    };

    const handleTouchEnd = () => {
      if (lockDirection === "y" && Math.abs(velocityY) >= TOUCH_MOMENTUM_MIN_VELOCITY_PX_PER_MS) {
        momentumVelocityY = velocityY;
        momentumFrameId = window.requestAnimationFrame(stepMomentum);
      }

      resetTouchState();
    };

    const handleTouchCancel = () => {
      resetTouchState();
    };

    wrapper.addEventListener("touchstart", handleTouchStart, { passive: true });
    wrapper.addEventListener("touchmove", handleTouchMove, { passive: false });
    wrapper.addEventListener("touchend", handleTouchEnd, { passive: true });
    wrapper.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      stopMomentum();
      wrapper.removeEventListener("touchstart", handleTouchStart);
      wrapper.removeEventListener("touchmove", handleTouchMove);
      wrapper.removeEventListener("touchend", handleTouchEnd);
      wrapper.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={["admin-table__wrapper", wrapperClassName].filter(Boolean).join(" ")}
    >
      <table className={["admin-table", className].filter(Boolean).join(" ")}>
        <caption className="admin-table__caption">{caption}</caption>
        {columnGroup}
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
};

export default AdminPanelTable;
