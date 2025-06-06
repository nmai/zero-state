// Importing directly costs 5kb bundle size or 10kb with vanjs-core/debug
import van from 'vanjs-core'

// If importing via <script> tag, use this instead:
// import type { Van } from "../static/lib/van-1.5.3.js"
// declare const van: Van

export const { add, state, derive } = van;
export const { div, a, form, label, input, span, ul, li, br, img, h2, h3, p, select, option } = van.tags

export default van;
