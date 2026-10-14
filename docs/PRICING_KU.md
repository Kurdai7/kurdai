# پلانی نوێی نرخەکانی KurdAI

پشکنینی سەرچاوە فەرمییەکان: ١٤ی ئۆکتۆبەری ٢٠٢٦. ئەم نرخانە پلانی پێشنیارکراون؛ مۆدێلە هەرزانەکان هێشتا بە وێبسایتەکە نەبەستراون و هیچ داواکارییەکی بە پارە تاقی نەکراوەتەوە.

## ئەنجام

فرۆشتنی کلیپی سادەی بێ دیالۆگی دروستکراوی سۆرانی بە €0.10–€0.20 لە ڕووی ژمێریارییەوە دەکرێت. هەڵبژاردەی سەرەتایی: Wan 2.2 Fast 5B، بە API ـی fal؛ نرخی ڕاگەیەنراوی 720p بۆ هەر داواکارییەک $0.025 ـە. نرخی دەستپێک: €0.15 بۆ کلیپی نزیکەی ٥ چرکە، بە مەرجی تاقیکردنەوەی ماوە، کوالێتی و پسووڵە. بەڵگەنامە وەسفی «تا ٥ چرکە» دەکات، بەڵام schema فڕەیم و FPS دەگۆڕێت؛ ماوەی default بە تەنها نابێت بە ٥ چرکە دابنرێت.

€0.10 تەنها دوای پێوانەکردنی خەرجییەکان و بەرهەمی زیاتر پێشنیار دەکرێت. ڤیدیۆی هەرزان بە مانای پشتگیری دیالۆگی سۆرانی، یەکسانیی بێ‌هەڵەی کارەکتەر یان Extensionی بێ‌پچڕان نییە.

## بەراوردی API

نرخەکان دۆلارن، پێش باج و خەرجی پارەدان. نرخی ئەپی کۆتایی یان داشکاندنی گرێبەست لەم بەراوردەدا نییە.

| مۆدێل و دابینکەر | ٥ چرکە | ١٠ چرکە | سنوور |
|---|---:|---:|---|
| Wan 2.2 Fast 5B، fal، 720p | $0.025 بۆ هەر داواکاری | بەو وەسفە پشتڕاست نییە | text-to-video؛ ماوەی ڕاستەقینە و FPS تاقی بکرێتەوە |
| Wan 2.2 T2V Plus، Alibaba International، 480p | $0.10 | نا؛ ئەم مۆدێلە ٥ چرکەییە | مۆدێلی ڕاستەوخۆی Alibaba؛ بێ دەنگ |
| Hailuo 02، MiniMax ڕاستەوخۆ، 512p | ٥ نییە؛ ٦ چرکە $0.10 | $0.15 | نرخەکەی fal جیاوازە؛ مۆڵەتی SaaSی ڕاستەوخۆ پێویستی بە پشتڕاستکردنەوە هەیە |
| Hailuo 2.3 Fast، MiniMax ڕاستەوخۆ، 768p | ٥ نییە؛ ٦ چرکە $0.19 | $0.32 | کوالێتی پێشنیاری دابینکەر، تاقی نەکراوەتەوە |
| Seedance 1.0 Pro Fast، fal، 720p | نزیکەی $0.108 | نزیکەی $0.216 | حسابکراو بەپێی 1280×720 و 24FPS و $1/M video tokens؛ پسووڵە دەکرێت بگۆڕێت |
| Kling 2.5 Turbo Standard I2V، fal | $0.21 | $0.42 | وێنە بۆ ڤیدیۆ؛ وێنەی پێشەکی پێویستە |
| Kling 2.5 Turbo Pro I2V، fal | $0.35 | $0.70 | هەڵبژاردەی گرانتر؛ یەکسانیی تەواو مسۆگەر نییە |

دوو کلیپی ٥ چرکەیی بە یەک ڤیدیۆی بێ‌پچڕانی ١٠ چرکەیی ناژمێرم. Seedance Lite و Kling 2.1 Standard لە fal deprecated نیشان دراون؛ نرخە کۆنەکانیان نابن بە بنەمای پلانی نوێ.

## API و مۆڵەتی بازرگانی

- Wan: APIی ڕاستەوخۆی Alibaba هەیە. Wan 2.2ی کراوە Apache 2.0 ـە؛ fal endpointی ناوبراوی بە Commercial use نیشان داوە. نرخە هەرزانەکەی fal هۆستکردنی fal ـە، نرخێکی ڕاستەوخۆی Alibaba نییە.
- Kling: APIی فەرمیی Kuaishou هەیە. نرخەکانی ئەم خشتەیە لە پەڕەی APIی fal وەرگیراون، کە Commercial use نیشان دەدات؛ نرخ و مۆڵەتی گرێبەستی ڕاستەوخۆی Kling بەوە یەکسان نازانرێت.
- Hailuo: APIی فەرمیی MiniMax هەیە. نرخی MiniMax لە خشتەکەدایە. fal endpointی Hailuoی بە Commercial use نیشان داوە، بەڵام ئەمە بەڵگەی هەموو مەرجەکانی SaaSی MiniMax ڕاستەوخۆ نییە.
- Seedance: APIی فەرمیی BytePlus هەیە؛ falی Seedance Pro Fast endpointێکی Partner و Commercial use ـە. نرخەکەی fal نابێت بە نرخی گرێبەستی BytePlus بناسرێت.
- مەرجەکانی fal ڕێگە بە بەرهەمی APIی ناوخزمەتگوزاری بۆ end users دەدەن؛ API key و APIی خام بە بەکارهێنەر نادرێت. مۆڵەتی مۆدێل، مافی وێنەکان و مەرجەکانی هەژمار هەر جێبەجێ دەبن.
- بۆ self-host: Wan 2.2 هەڵبژاردەیەکی Apache 2.0 ـە. LTX-2.3ی weights مۆڵەتی Community هەیە، نەک Apacheی بێ مەرج؛ داهاتی ساڵانەی $10M یان زیاتر پێویستی بە مۆڵەتی بازرگانیی پارەدار هەیە. GPU، بارکردنی مۆدێل، کاتی بێکار و چاککردنەوەش خەرجین. بێ benchmark نرخی هەر کلیپێکی self-host دیاری ناکرێت. پلانی ئاسایی Workers بە تەنها GPUی ئەم مۆدێلانە نییە.

## حسابی خەرجی و سود

گریمانەکان: €1 = $1.1188، نرخی ECBی ١٣ی ئۆکتۆبەر؛ ٢٪ بۆ گۆڕینی دراو؛ VATی نموونەی فینلاند 25.5٪؛ Stripe بۆ کارتی standard EEA بە 1.5٪ + €0.25 بۆ هەر کڕین؛ کڕینی کەمترین پەک €2؛ ٢٠٪ زیادە لەسەر API بۆ دووبارەدروستکردن؛ ٣٪ی فرۆشتن بۆ refund/هەڵە؛ بودجەی سێرڤەر €5/مانگ + €0.001 بۆ کلیپ.

€5 بودجەی پلاندانانە، نەک نرخێکی مسۆگەری هەموو هۆستکردن. Cloudflare Workers Paid لە $5/مانگ دەست پێ دەکات؛ D1، storage، domain و زیادەبەکارهێنان پێویستیان بە پێوانەکردن هەیە. کارتی نێودەوڵەتی و گۆڕینی دراو لە Stripe گرانترن.

نموونە: Wan Fast 5B بە نرخی €0.15، کڕینی €2 و ١٠٠ کلیپ لە مانگێکدا:

| بڕ | یۆرۆ |
|---|---:|
| پارەی فرۆشتن بە VAT | 0.1500 |
| VATی لێ دەردەکرێت | 0.0305 |
| API لەگەڵ ٢٪ bufferی دراو | 0.0228 |
| bufferی دووبارەدروستکردن | 0.0046 |
| بەشی Stripe | 0.0210 |
| سێرڤەر و خەرجی گۆڕاو | 0.0510 |
| refund reserve | 0.0045 |
| ماوە پێش باجی داهات و خەرجییە نەحسابکراوەکان | 0.0157 |

لە ١٠٠٠ کلیپ/مانگدا، بە هەمان نرخی €0.15 بڕی ماوە نزیکەی €0.0607 بۆ هەر کلیپە. ئەگەر نرخ €0.10 بێت، لە ١٠٠ کلیپ/مانگدا زیان نزیکەی €0.0157 بۆ هەر کلیپە؛ لە ١٠٠٠دا ماوە نزیکەی €0.0293 ـە.

خاڵی نەزیان: نزیکەی €0.125 بۆ Wan لە ١٠٠ کلیپ/مانگدا، یان €0.0532 لە ١٠٠٠دا. ئەمانە تەنها سنووری ژمێریاریی ئەم گریمانانەن؛ هەڵەی کوالێتی یان خەرجیی زیادە دەتوانێت سودەکە بسڕێتەوە. نرخی دەستپێکی پێشنیارکراو €0.15 ـە، بە تاقیکردنەوە پێش فرۆشتن.

باجی داهاتی خۆت دیاری نەکراوە؛ لە tmi بە داهاتەکانی دیکە و جۆری داهات دەبەسترێتەوە. ٣٠٪ تەنها سناریۆی buffer ـە: €0.0157 دەکاتە نزیکەی €0.0110. مووچەی خۆت، ژمێریاری، مارکێتینگ، YEL و خەرجی دەرەوەی بودجەی سێرڤەر لەم بڕەدا نەحسابکراون. فرۆشتنی نێودەوڵەتی دەکرێت VATی جیاواز هەبێت. نرخی VATی خۆت پێویستی بە دۆخی تۆمارکردن هەیە؛ 25.5٪ی مووچە یان tax card بە باجی سودی KurdAI دانەنراوە.

## نرخ و Creditsی پێشنیارکراو

١ Credit = €0.01 لە نرخی کڕینی گشتی بە VATی گریمانەکراو. پەکەکان: €2 = 200 Credits، €5 = 500، €10 = 1000. سەبسکریپشن پێویست نییە؛ پارەی هەر ڤیدیۆیەک بە جیا لە کارت وەرناگیرێت.

| بەرهەم | Credits | نرخی پێشنیارکراو |
|---|---:|---:|
| Economy: Wan Fast 5B، 720p، تا ٥ چرکە | 15 | €0.15 |
| Standard: Seedance Fast، 720p، ٥ چرکە | 30 | €0.30 |
| Standard: Seedance Fast، 720p، ١٠ چرکە | 55 | €0.55 |
| Budget I2V: Hailuo 02، 512p، ٦ چرکە | 30 | €0.30 |
| Budget I2V: Hailuo 02، 512p، ١٠ چرکە | 40 | €0.40 |
| Pro: Kling 2.5 Standard، ٥ چرکە | 55 | €0.55 |
| Pro: Kling 2.5 Standard، ١٠ چرکە | 100 | €1.00 |

ئەمانە نرخە سەرەتاییەکانن کە لە گریمانەی ١٠٠ کلیپ/مانگدا خەرجییە لیستکراوەکان دەپۆشن؛ هەموویان سودی تەواوی کۆمپانیا مسۆگەر ناکەن. جۆری «Pro» بەپێی workflow و reference image هەڵبژێردراوە، نەک benchmarkی کوالێتیی خۆمان.

## ڕەفتاری سیستەمی Credits

- سەرەتا نرخی کۆتایی، ماوە، resolution، مۆدێل و بوون/نەبوونی دەنگ پیشان بدرێت.
- کرێدیت بە transactionی یەکجارە reserve بکرێت؛ دەرئەنجامی سەرکەوتوو دەیکاتە debit.
- شکستی پشتڕاستکراو reserve ئازاد دەکات. timeoutی نادیار داواکاریی نوێی بە پارە دروست ناکات؛ پشکنینی operation بەردەوام دەبێت.
- refund، webhook و replay دەبێت idempotent بن؛ کرێدیتی پارەدار لە خۆڕایی جیا بێت.
- نەبوونی ئەنجامی دڵخواز هەمیشە بە مانای نەخەرجکردنی API نییە؛ unlimited regeneration نییە.
- روزانە ٣٠ کرێدیتی خۆڕایی نابێت بێ سنوور بتوانێت APIی بە پارە بەکاربهێنێت؛ free preview دەکرێت پرۆمپت و ڕێکخستن بێت.
- automatic upgrade بۆ Veo یان مۆدێلی گرانتر بێ ڕەزامەندی بەکارهێنەر نابێت.

`pricing.js` نرخ و حسابەکانی ئەم پلانە بە شێوەی planning-only هەڵدەگرێت. هیچ checkout، پارەدان یان بەستنی providerی هەرزان بە درۆ چالاک نیشان نەدراوە. ledgerی reserve/debit/refund هێشتا جێبەجێ نەکراوە.

## هەنگاوی داهاتوو

پێش هەر کڕین، زیادکردنی balance، گرێبەست یان داواکاریی بە پارە، ڕەزامەندیی جیاواز پێویستە. پشکنینی فەرمیی ئەکاونت و invoice و سنووری کەمترین top-up ماوە. تاقیکردنەوەی کوالێتی دەبێت بە هەمان پرۆمپت و referenceی ئەنیمەیشنی کوردی ئەنجام بدرێت؛ ڤیدیۆی بێ دەنگ و native Sorani dialogue بە یەکسان دانانرێن.

## سەرچاوەکان

- Wan Fast 5B pricing: https://fal.ai/models/fal-ai/wan/v2.2-5b/text-to-video/fast-wan
- Wan frames/FPS schema: https://fal.ai/models/fal-ai/wan/v2.2-5b/text-to-video/fast-wan/api
- Wan direct pricing: https://www.alibabacloud.com/help/en/model-studio/model-pricing
- Wan direct duration restrictions: https://www.alibabacloud.com/help/en/model-studio/legacy-wan-text-to-video-api-reference
- Wan open model license: https://github.com/Wan-Video/Wan2.2
- MiniMax pricing: https://platform.minimax.io/docs/pricing/overview
- Hailuo hosted commercial label and different rates: https://fal.ai/models/fal-ai/minimax/hailuo-02/standard/image-to-video
- Kling standard: https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/standard/image-to-video
- Kling pro: https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video
- Kling official API: https://kling.ai/document-api
- Seedance Fast pricing: https://fal.ai/models/fal-ai/bytedance/seedance/v1/pro/fast/text-to-video
- Seedance native durations: https://fal.ai/models/fal-ai/bytedance/seedance/v1/pro/fast/text-to-video/api
- BytePlus official API: https://docs.byteplus.com/docs/modelark/create-video-generation-task-api
- fal SaaS terms: https://fal.ai/legal/terms-of-service
- LTX weights license: https://huggingface.co/Lightricks/LTX-2.3/blob/main/LICENSE
- Cloudflare: https://developers.cloudflare.com/workers/platform/pricing/
- Stripe Finland: https://stripe.com/en-fi/pricing
- ECB: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html
- VAT: https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/vat/rates-of-vat/
- Income tax: https://www.vero.fi/en/businesses-and-corporations/business-operations/setting-up-a-business/checklist-for-the-founder-of-a-new-business/
