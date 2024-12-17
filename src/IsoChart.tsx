import React from "react";

type BlendMode =
    | "color"
    | "color-burn"
    | "color-dodge"
    | "darken"
    | "difference"
    | "exclusion"
    | "hard-light"
    | "hue"
    | "lighten"
    | "luminosity"
    | "multiply"
    | "normal"
    | "overlay"
    | "saturation"
    | "screen"
    | "soft-light"
    | "plus-lighter"
    | undefined;

const BLEND_MODE: BlendMode = "normal";
const RADIAL_GRADIENT_RADIUS = 1.0;

const interpolateColor = (t: number, ...colors: string[]) => {
    const numComponents = colors.length;
    if (numComponents == 0) return "#000000";

    /// TODO: Move this to useMemo and reuse, there is no reason to recalculate these...
    const colorComponents = colors.map((color) => {
        return {
            r: Number(`0x${color.slice(1, 3)}`),
            g: Number(`0x${color.slice(3, 5)}`),
            b: Number(`0x${color.slice(5, 7)}`),
        };
    });

    let startIndex = Math.floor(t * (numComponents - 1));

    if (startIndex == numComponents - 1) startIndex = startIndex - 1;

    return (
        "#" +
        Math.round(colorComponents[startIndex].r * (1 - t) + colorComponents[startIndex + 1].r * t)
            .toString(16)
            .padStart(2, "0") +
        Math.round(colorComponents[startIndex].g * (1 - t) + colorComponents[startIndex + 1].g * t)
            .toString(16)
            .padStart(2, "0") +
        Math.round(colorComponents[startIndex].b * (1 - t) + colorComponents[startIndex + 1].b * t)
            .toString(16)
            .padStart(2, "0")
    );
};

export type IsoChartProps = {
    width: number;
    height: number;
    yScaleHeight: number;
    phi: number;
    setPhi?: (newValue: number) => void;
    psi: number;
    setPsi?: (newValue: number) => void;
    data: (number | null)[][];
    showLabels?: boolean;
    customXLabels?: string[];
    customYLabels?: string[];
    colors?: string[];
    interpolationControlHandleLengthRatio?: number;
    margin?: number;
    showPoints?: boolean;
    showGrid?: boolean;
    gridColor?: string;
    gridStrokeWidth?: number;
    pointRadius?: number;
};

export const IsoChart = ({
    width,
    height,
    yScaleHeight,
    phi,
    setPhi,
    psi,
    setPsi,
    margin = 0.0,
    data,
    colors = ["#FFF022", "#FF0099"],
    showLabels = false,
    customXLabels,
    customYLabels,
    interpolationControlHandleLengthRatio = 0.0,
    showPoints = true,
    showGrid = true,
    gridColor = "#000000",
    gridStrokeWidth = 1.0,
    pointRadius,
}: IsoChartProps) => {
    const [discreteWidth, discreteHeight] = React.useMemo(() => {
        return [data.length, data.length > 0 ? data[0].length : 0];
    }, [data]);

    const [max, min] = React.useMemo(() => {
        let [max, min] = [1e-32, 0];

        data.forEach((c) =>
            c.forEach((v) => {
                max = v && max < v ? v : max;
                min = v && min > v ? v : min;
            })
        );

        return [max, min];
    }, [data]);

    const heightMultiplier = React.useMemo(() => {
        return Math.cos(phi);
    }, [phi]);

    const [unscaledWidth, unscaledHeight] = React.useMemo(() => {
        const w =
            (discreteWidth + discreteHeight - 2) * Math.cos(psi) - (discreteWidth - discreteHeight) * Math.sin(psi);

        const h =
            (discreteWidth + discreteHeight - 2) * Math.sin(psi) + (discreteWidth - discreteHeight) * Math.cos(psi);

        return [w, h];
    }, [psi, phi, discreteHeight, discreteWidth]);

    const [deltaX, deltaY] = React.useMemo(() => {
        const xComponent = Math.cos(phi / 2.0);
        const yComponent = Math.sin(phi / 2.0);

        const length = Math.min(
            (height - margin * 2 - yScaleHeight * heightMultiplier) /
                ((discreteHeight + discreteWidth - 2) * yComponent),
            (width - margin * 2) / ((discreteHeight + discreteWidth - 2) * xComponent)
        );

        return [xComponent * length, yComponent * length];
    }, [phi, width, height, discreteWidth, discreteHeight, max, psi]);

    const originY = React.useMemo(() => {
        return (height - unscaledHeight * deltaY) / 2;
    }, [deltaY, unscaledHeight]);

    const originX = React.useMemo(() => {
        return (width - unscaledWidth * deltaX) / 2;
    }, [deltaX, unscaledWidth]);

    const plot = (xIndex: number, yIndex: number, z: number) => {
        // Isometric coordinates
        const x = xIndex + yIndex;
        const y = xIndex - yIndex;
        const zHeight = z / max;

        // Apply vertical-axis tilt controlled by psi
        const rotatedX = x * Math.cos(psi) - y * Math.sin(psi);
        const rotatedY = x * Math.sin(psi) + y * Math.cos(psi);

        return [
            originX + margin + rotatedX * deltaX,
            originY + deltaY * rotatedY - heightMultiplier * yScaleHeight * zHeight,
        ];
    };

    const colorFor = (height: number) => {
        return interpolateColor((height - min) / (max - min), ...colors);
    };

    // Stores an array of _upper left corners_, since that's all we really need.
    const faces: { x: number; y: number }[] = React.useMemo(() => {
        let faces: { x: number; y: number }[] = [];

        for (let xIndex = 0; xIndex < data.length - 1; xIndex += 1) {
            let column = data[xIndex];
            let nextColumn = data[xIndex + 1];
            // Since we would like to render back to front, we will traverse
            // backwards.
            for (let yIndex = column.length - 1; yIndex > 0 /* bottom cannot be upper left */; yIndex -= 1) {
                if (column[yIndex] && column[yIndex - 1] && nextColumn[yIndex] && nextColumn[yIndex - 1])
                    faces.push({ x: xIndex, y: yIndex });
            }
        }

        return faces;
    }, [data]);

    const generateXGrid = () => {
        return (
            <>
                {data.map((_, i) => {
                    const posStart = plot(i, 0, 0);
                    const posEnd = plot(i, discreteHeight - 1, 0);
                    return (
                        <line
                            key={`yGridline${i}`}
                            x1={posStart[0]}
                            y1={posStart[1]}
                            x2={posEnd[0]}
                            y2={posEnd[1]}
                            strokeWidth={gridStrokeWidth}
                            stroke={gridColor}
                        />
                    );
                })}
            </>
        );
    };

    const generateYGrid = () => {
        return (
            <>
                {data.length > 0 ? (
                    data[0].map((_, i) => {
                        const posStart = plot(0, i, 0);
                        const posEnd = plot(discreteWidth - 1, i, 0);
                        return (
                            <line
                                key={`xGridline${i}`}
                                x1={posStart[0]}
                                y1={posStart[1]}
                                x2={posEnd[0]}
                                y2={posEnd[1]}
                                stroke={gridColor}
                                strokeWidth={gridStrokeWidth}
                            />
                        );
                    })
                ) : (
                    <></>
                )}
            </>
        );
    };

    const generateFaces = () => {
        return (
            <>
                {faces.map((face, index) => {
                    const values = [
                        data[face.x][face.y] as number,
                        data[face.x][face.y - 1] as number,
                        data[face.x + 1][face.y - 1] as number,
                        data[face.x + 1][face.y] as number,
                    ];

                    const { p1, p1_control_1, p1_control_2 } = {
                        p1: plot(face.x, face.y, values[0]),
                        p1_control_1: plot(face.x, face.y - interpolationControlHandleLengthRatio, values[0]),
                        p1_control_2: plot(face.x, face.y - 1 + interpolationControlHandleLengthRatio, values[1]),
                    };

                    const { p2, p2_control_1, p2_control_2 } = {
                        p2: plot(face.x, face.y - 1, values[1]),
                        p2_control_1: plot(face.x + interpolationControlHandleLengthRatio, face.y - 1, values[1]),
                        p2_control_2: plot(face.x + 1 - interpolationControlHandleLengthRatio, face.y - 1, values[2]),
                    };

                    const { p3, p3_control_1, p3_control_2 } = {
                        p3: plot(face.x + 1, face.y - 1, values[2]),
                        p3_control_1: plot(face.x + 1, face.y - 1 + interpolationControlHandleLengthRatio, values[2]),
                        p3_control_2: plot(face.x + 1, face.y - interpolationControlHandleLengthRatio, values[3]),
                    };
                    const { p4, p4_control_1, p4_control_2 } = {
                        p4: plot(face.x + 1, face.y, values[3]),
                        p4_control_1: plot(face.x + 1 - interpolationControlHandleLengthRatio, face.y, values[3]),
                        p4_control_2: plot(face.x + interpolationControlHandleLengthRatio, face.y, values[0]),
                    };

                    const face_avg_value =
                        values.reduce((prev, curr) => {
                            return prev + curr;
                        }, 0) / 4.0;

                    const tilePath = (fill: boolean, stroke: boolean) => (
                        <path
                            style={{
                                mixBlendMode: undefined as any,
                            }}
                            id={`face${index}`}
                            d={
                                `M ${p1[0]} ${p1[1]} ` +
                                `C ${p1_control_1[0]} ${p1_control_1[1]} ${p1_control_2[0]} ${p1_control_2[1]} ${p2[0]} ${p2[1]} ` +
                                `C ${p2_control_1[0]} ${p2_control_1[1]} ${p2_control_2[0]} ${p2_control_2[1]} ${p3[0]} ${p3[1]} ` +
                                `C ${p3_control_1[0]} ${p3_control_1[1]} ${p3_control_2[0]} ${p3_control_2[1]} ${p4[0]} ${p4[1]} ` +
                                `C ${p4_control_1[0]} ${p4_control_1[1]} ${p4_control_2[0]} ${p4_control_2[1]} ${p1[0]} ${p1[1]} Z`
                            }
                            fill={fill ? colorFor(face_avg_value) : "#00000000"}
                            stroke={gridColor}
                            strokeWidth={stroke ? gridStrokeWidth : 0}
                        />
                    );

                    const avgX = (p1[0] + p2[0] + p3[0] + p4[0]) / 4;
                    const avgY = (p1[1] + p2[1] + p3[1] + p4[1]) / 4;

                    const p1Radius = Math.sqrt(Math.pow(p1[0] - avgX, 2) + Math.pow(p1[1] - avgY, 2));
                    const p2Radius = Math.sqrt(Math.pow(p2[0] - avgX, 2) + Math.pow(p2[1] - avgY, 2));
                    const p3Radius = Math.sqrt(Math.pow(p3[0] - avgX, 2) + Math.pow(p3[1] - avgY, 2));
                    const p4Radius = Math.sqrt(Math.pow(p4[0] - avgX, 2) + Math.pow(p4[1] - avgY, 2));

                    // This is a little gross but whatever
                    return (
                        <g key={`face${index}_group`}>
                            <defs>
                                <clipPath id={`face${index}_clipPath`}>{tilePath(false, false)}</clipPath>
                                {Array(4)
                                    .fill(0)
                                    .map((_, i) => {
                                        return (
                                            <>
                                                <radialGradient
                                                    id={`face${index}_gradient${i}`}
                                                    key={`face${index}_gradient${i}`}
                                                    cx="50%"
                                                    cy="50%"
                                                    r={`50%`}
                                                    fx="50%"
                                                    fy="50%"
                                                >
                                                    {Array(colors.length + 1)
                                                        .fill(0)
                                                        .map((_, j) => {
                                                            const myWeight =
                                                                (RADIAL_GRADIENT_RADIUS * (colors.length - j)) /
                                                                    colors.length +
                                                                (1 - RADIAL_GRADIENT_RADIUS);
                                                            const oppositeWeight = 1 - myWeight;

                                                            const myValue = data[face.x + Math.floor(i / 2)][
                                                                face.y - (Math.ceil(i / 2) % 2)
                                                            ] as number;

                                                            const interpolationValue =
                                                                myWeight * myValue + oppositeWeight * face_avg_value;

                                                            if (j == colors.length) console.log(interpolationValue);

                                                            return (
                                                                <stop
                                                                    offset={`${(j * 100) / colors.length}%`}
                                                                    style={{
                                                                        stopColor: colorFor(interpolationValue),
                                                                        stopOpacity:
                                                                            (colors.length - j) / colors.length,
                                                                    }}
                                                                />
                                                            );
                                                        })}
                                                    {/* {!!(window as any).chrome || navigator.userAgent.indexOf("Firefox") != -1 ? (
                          // For some reason, the gradients look _way worse_ on chromium browsers.
                          // This is an attempt to compensate. It still looks worse, but more heatmap-like.
                          // In the future, it would be nice to render mesh gradients, but that will be computationally expensive, I'd guess.
                          <stop
                            offset="50%"
                            style={{
                              stopColor: colorFor((data[face.x][face.y] as number) * 0.4),
                              stopOpacity: 0.4,
                            }}
                          />
                        ) : (
                          <></>
                        )}
                        <stop
                          offset="100%"
                          style={{
                            stopColor: colorFor(data[face.x][face.y] as number),
                            stopOpacity: 0.0,
                          }}
                        /> */}
                                                </radialGradient>
                                            </>
                                        );
                                    })}
                            </defs>
                            {tilePath(true, false)}
                            {(face.x + face.y) % 2 == 0 ? (
                                <>
                                    <circle
                                        style={{ mixBlendMode: BLEND_MODE }}
                                        cx={p2[0]}
                                        cy={p2[1]}
                                        r={p2Radius}
                                        clipPath={`url(#face${index}_clipPath)`}
                                        fill={`url(#face${index}_gradient1)`}
                                    />
                                    <circle
                                        style={{ mixBlendMode: BLEND_MODE }}
                                        cx={p4[0]}
                                        cy={p4[1]}
                                        r={p4Radius}
                                        clipPath={`url(#face${index}_clipPath)`}
                                        fill={`url(#face${index}_gradient3)`}
                                    />
                                    <circle
                                        style={{ mixBlendMode: BLEND_MODE }}
                                        cx={p1[0]}
                                        cy={p1[1]}
                                        r={p1Radius}
                                        clipPath={`url(#face${index}_clipPath)`}
                                        fill={`url(#face${index}_gradient0)`}
                                    />
                                    <circle
                                        style={{ mixBlendMode: BLEND_MODE }}
                                        cx={p3[0]}
                                        cy={p3[1]}
                                        r={p3Radius}
                                        clipPath={`url(#face${index}_clipPath)`}
                                        fill={`url(#face${index}_gradient2)`}
                                    />
                                </>
                            ) : (
                                <>
                                    <circle
                                        style={{ mixBlendMode: BLEND_MODE }}
                                        cx={p1[0]}
                                        cy={p1[1]}
                                        r={p1Radius}
                                        clipPath={`url(#face${index}_clipPath)`}
                                        fill={`url(#face${index}_gradient0)`}
                                    />
                                    <circle
                                        style={{ mixBlendMode: BLEND_MODE }}
                                        cx={p3[0]}
                                        cy={p3[1]}
                                        r={p3Radius}
                                        clipPath={`url(#face${index}_clipPath)`}
                                        fill={`url(#face${index}_gradient2)`}
                                    />
                                    <circle
                                        style={{ mixBlendMode: BLEND_MODE }}
                                        cx={p2[0]}
                                        cy={p2[1]}
                                        r={p2Radius}
                                        clipPath={`url(#face${index}_clipPath)`}
                                        fill={`url(#face${index}_gradient1)`}
                                    />
                                    <circle
                                        style={{ mixBlendMode: BLEND_MODE }}
                                        cx={p4[0]}
                                        cy={p4[1]}
                                        r={p4Radius}
                                        clipPath={`url(#face${index}_clipPath)`}
                                        fill={`url(#face${index}_gradient3)`}
                                    />
                                </>
                            )}

                            {tilePath(false, true)}
                        </g>
                    );
                })}
            </>
        );
    };

    const [hoverPoint, setHoverPoint] = React.useState<{
        x: number;
        y: number;
    } | null>(null);

    const generatePoints = () => {
        return data.map((col, x) => {
            return col.map((value, y) => {
                if (value) {
                    const point = plot(x, y, value);
                    return (
                        <g key={`point${x}_${y}`}>
                            <circle
                                onMouseEnter={() => setHoverPoint({ x, y })}
                                onMouseLeave={() => setHoverPoint(null)}
                                cx={point[0]}
                                cy={point[1]}
                                r={pointRadius ? pointRadius : 2 * gridStrokeWidth}
                                fill={hoverPoint && hoverPoint.x == x && hoverPoint.y == y ? gridColor : "#00000000"}
                            />
                            <circle
                                onMouseEnter={() => setHoverPoint({ x, y })}
                                cx={point[0]}
                                cy={point[1]}
                                r={2}
                                fill={gridColor}
                            />
                        </g>
                    );
                } else return <></>;
            });
        });
    };

    const generateYLabels = () => {
        return (customYLabels ? customYLabels : data.length > 0 ? data[0].map((_, i) => i) : []).map((_, i) => {
            const p = plot(0, i, 0);
            return (
                <text key={`yAxisLabel${i}`} x={p[0] - 5} y={p[1] - 5} textAnchor={"end"}>
                    {i}
                </text>
            );
        });
    };

    const generateXLabels = () => {
        return (customXLabels ? customXLabels : data.map((_, i) => i)).map((v, i) => {
            const p = plot(i, 0, 0);
            return (
                <text key={`yAxisLabel${i}`} x={p[0] - 5} y={p[1] + 5} textAnchor={"end"} dominantBaseline={"hanging"}>
                    {v}
                </text>
            );
        });
    };

    const [watchMouse, setWatchMouse] = React.useState(false);
    const [dragOrigin, setDragOrigin] = React.useState({ x: 0, y: 0 });
    const [originalPhi, setOriginalPhi] = React.useState(0);
    const [originalPsi, setOriginalPsi] = React.useState(0);

    return (
        <div
            style={{
                width: width,
                height: height,
            }}
            onMouseDown={(e) => {
                setWatchMouse(true);
                setDragOrigin({
                    x: e.pageX,
                    y: e.pageY,
                });
                setOriginalPhi(phi);
                setOriginalPsi(psi);
            }}
            onMouseUp={() => setWatchMouse(false)}
            onMouseLeave={() => setWatchMouse(false)}
            onMouseMove={(e) => {
                if (watchMouse) {
                    if (setPhi)
                        setPhi(Math.max(0, Math.min(originalPhi + (e.pageY - dragOrigin.y) / 200, Math.PI / 2)));
                    if (setPsi)
                        setPsi(
                            Math.max(-Math.PI / 4, Math.min(originalPsi + (-e.pageX + dragOrigin.x) / 200, Math.PI / 4))
                        );
                }
            }}
        >
            <svg width={width} height={height} style={{ overflow: "visible" }}>
                {showLabels ? generateYLabels() : <></>}
                {showLabels ? generateXLabels() : <></>}
                {showGrid ? generateYGrid() : <></>}
                {showGrid ? generateXGrid() : <></>}
                {generateFaces()}
                {showPoints ? generatePoints() : <></>}
            </svg>
        </div>
    );
};
