/* eslint-disable @next/next/no-img-element -- Satori requires a plain img element. */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Duti — a private, personal project workspace";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const logoData = await readFile(
  join(process.cwd(), "public/icons/android-chrome-192x192.png"),
  "base64",
);
const logoSrc = `data:image/png;base64,${logoData}`;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
          background: "#f6f4f0",
          color: "#232222",
          padding: "72px 80px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -180,
            right: -100,
            width: 560,
            height: 560,
            borderRadius: "50%",
            background: "#ebe4d9",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 180,
            bottom: -240,
            width: 420,
            height: 420,
            borderRadius: "50%",
            border: "2px solid #ded5c7",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <img
            src={logoSrc}
            alt=""
            width={80}
            height={80}
            style={{ borderRadius: 20 }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 40, letterSpacing: -1 }}>Duti</div>
            <div
              style={{
                color: "#6f6860",
                fontSize: 16,
                letterSpacing: 3,
              }}
            >
              PERSONAL PROJECT MANAGER
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 900,
              fontSize: 82,
              letterSpacing: -3,
              lineHeight: 1.02,
            }}
          >
            <div>A private, personal</div>
            <div>project workspace.</div>
          </div>
          <div
            style={{
              maxWidth: 760,
              color: "#6f6860",
              fontSize: 30,
              lineHeight: 1.4,
            }}
          >
            Projects, boards, and tasks — organized without the noise.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          {["Projects", "Boards", "Tasks"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 18px",
                border: "1px solid #d8cfc2",
                borderRadius: 999,
                background: "#fbf9f5",
                color: "#4a443d",
                fontSize: 18,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
