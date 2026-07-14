import React from "react";

export default function GridShape() {
  return (
    <>
      <div className="absolute right-0 top-0 -z-1 w-full max-w-[250px] xl:max-w-[450px] opacity-10">
        <svg
          width="540"
          height="254"
          viewBox="0 0 540 254"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-gray-400 dark:text-gray-600"
        >
          <rect x="0" y="0" width="540" height="254" fill="currentColor" opacity="0.1" />
          <line x1="0" y1="0" x2="540" y2="254" stroke="currentColor" strokeWidth="1" opacity="0.2" />
          <line x1="540" y1="0" x2="0" y2="254" stroke="currentColor" strokeWidth="1" opacity="0.2" />
          <line x1="270" y1="0" x2="270" y2="254" stroke="currentColor" strokeWidth="1" opacity="0.1" />
          <line x1="0" y1="127" x2="540" y2="127" stroke="currentColor" strokeWidth="1" opacity="0.1" />
        </svg>
      </div>
      <div className="absolute bottom-0 left-0 -z-1 w-full max-w-[250px] rotate-180 xl:max-w-[450px] opacity-10">
        <svg
          width="540"
          height="254"
          viewBox="0 0 540 254"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-gray-400 dark:text-gray-600"
        >
          <rect x="0" y="0" width="540" height="254" fill="currentColor" opacity="0.1" />
          <line x1="0" y1="0" x2="540" y2="254" stroke="currentColor" strokeWidth="1" opacity="0.2" />
          <line x1="540" y1="0" x2="0" y2="254" stroke="currentColor" strokeWidth="1" opacity="0.2" />
          <line x1="270" y1="0" x2="270" y2="254" stroke="currentColor" strokeWidth="1" opacity="0.1" />
          <line x1="0" y1="127" x2="540" y2="127" stroke="currentColor" strokeWidth="1" opacity="0.1" />
        </svg>
      </div>
    </>
  );
}
