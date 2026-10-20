/**
 * Writes docs/README.{lang}.md: a short page per language with the quick guide from the Help panel (src/i18n/{lang}.json,
 * `help.*`) and links to the site and the full English guide (docs/guide.md). Translators fix the guide in the phrase
 * files; the few sentences below are the only other text.
 *
 * Run: `pnpm readmes` after changing `help.*` phrases or the text below.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LANGUAGE_NAMES, LANGUAGES, type Lang } from '../src/i18n.ts'

const ROOT = join(import.meta.dirname, '..')
const SITE = 'https://el8ted.github.io/gwentdecksearch/'

/**
 * Per-language text outside the Help panel: intro, "open the site", "full guide in English", translation note, and
 * the overview screenshot's description.
 */
const TEXT: Record<Exclude<Lang, 'en'>, [string, string, string, string, string]> = {
  de: [
    'Gwent Deck Search listet veröffentlichte Decks für GWENT: The Witcher Card Game und grenzt sie ein, während du Fraktion, Anführer und gesehene Karten wählst.',
    'Seite auf Deutsch öffnen',
    'Die vollständige Anleitung gibt es auf Englisch',
    'Diese Seite wurde maschinell übersetzt. Korrekturen sind willkommen:',
    'Die Seite auf Deutsch: Filter oben, passende Decks darunter, rechts die häufigsten Karten dieser Decks',
  ],
  es: [
    'Gwent Deck Search lista los mazos publicados de GWENT: The Witcher Card Game y los filtra a medida que eliges facción, líder y las cartas que has visto.',
    'Abrir el sitio en español',
    'La guía completa está en inglés',
    'Esta página se tradujo automáticamente. Las correcciones son bienvenidas:',
    'La página en español: filtros arriba, mazos coincidentes debajo y, a la derecha, las cartas más comunes de esos mazos',
  ],
  fr: [
    'Gwent Deck Search liste les decks publiés de GWENT: The Witcher Card Game et les filtre à mesure que vous choisissez une faction, un chef et les cartes que vous avez vues.',
    'Ouvrir le site en français',
    'Le guide complet est en anglais',
    'Cette page a été traduite automatiquement. Les corrections sont les bienvenues :',
    'La page en français : filtres en haut, decks correspondants en dessous et, à droite, les cartes les plus courantes de ces decks',
  ],
  it: [
    'Gwent Deck Search elenca i mazzi pubblicati di GWENT: The Witcher Card Game e li restringe mentre scegli fazione, comandante e le carte che hai visto.',
    'Apri il sito in italiano',
    'La guida completa è in inglese',
    'Questa pagina è stata tradotta automaticamente. Le correzioni sono benvenute:',
    'La pagina in italiano: filtri in alto, mazzi corrispondenti sotto e, a destra, le carte più comuni di quei mazzi',
  ],
  ja: [
    'Gwent Deck Search は「グウェント ウィッチャーカードゲーム」の公開デッキを一覧にし、勢力・リーダー・見たカードを選ぶたびに絞り込みます。',
    '日本語でサイトを開く',
    '詳しいガイドは英語です',
    'このページは機械翻訳です。修正を歓迎します：',
    '日本語表示のページ：上にフィルター、下に一致するデッキ、右にそれらのデッキでよく使われるカード',
  ],
  ko: [
    'Gwent Deck Search는 궨트: 더 위쳐 카드 게임의 공개 덱을 보여 주고, 세력·지도자·본 카드를 고를 때마다 목록을 좁혀 줍니다.',
    '한국어로 사이트 열기',
    '전체 안내는 영어로 되어 있습니다',
    '이 페이지는 기계 번역되었습니다. 수정은 언제나 환영합니다:',
    '한국어로 표시된 페이지: 위에는 필터, 아래에는 일치하는 덱, 오른쪽에는 그 덱들에서 가장 많이 쓰는 카드',
  ],
  pl: [
    'Gwent Deck Search wyświetla opublikowane talie do GWINT: Wiedźmińska Gra Karciana i zawęża je, gdy wybierasz frakcję, dowódcę i widziane karty.',
    'Otwórz stronę po polsku',
    'Pełny przewodnik jest po angielsku',
    'Ta strona została przetłumaczona maszynowo. Poprawki są mile widziane:',
    'Strona po polsku: filtry u góry, pasujące talie poniżej, a po prawej najczęstsze karty w tych taliach',
  ],
  'pt-BR': [
    'O Gwent Deck Search lista os decks publicados de GWENT: The Witcher Card Game e os filtra conforme você escolhe facção, líder e as cartas que viu.',
    'Abrir o site em português',
    'O guia completo está em inglês',
    'Esta página foi traduzida automaticamente. Correções são bem-vindas:',
    'A página em português: filtros no topo, decks correspondentes abaixo e, à direita, as cartas mais comuns desses decks',
  ],
  ru: [
    'Gwent Deck Search показывает опубликованные колоды для ГВИНТ: Ведьмак. Карточная игра и сужает список по мере того, как вы выбираете фракцию, лидера и увиденные карты.',
    'Открыть сайт на русском',
    'Полное руководство — на английском',
    'Эта страница переведена автоматически. Исправления приветствуются:',
    'Страница на русском: фильтры сверху, подходящие колоды ниже, справа — самые частые карты в этих колодах',
  ],
  'zh-cn': [
    'Gwent Deck Search 列出《巫师之昆特牌》的已发布卡组，并随着你选择阵营、领袖和看到的卡牌逐步缩小范围。',
    '用简体中文打开网站',
    '完整指南为英文',
    '本页为机器翻译，欢迎指正：',
    '简体中文界面：上方为筛选，下方为符合的卡组，右侧为这些卡组中最常见的卡牌',
  ],
}

const bar = (current: Lang) =>
  LANGUAGES.map((l) => {
    const name = LANGUAGE_NAMES[l]
    return l === current ? `**${name}**` : `[${name}](${l === 'en' ? '../README.md' : `README.${l}.md`})`
  }).join(' · ')

for (const lang of LANGUAGES) {
  if (lang === 'en') continue
  const phrases: Record<string, string> = JSON.parse(readFileSync(join(ROOT, 'src', 'i18n', `${lang}.json`), 'utf8'))
  const [intro, open, full, machine, alt] = TEXT[lang]
  // The Craft step follows the decks one, as in the Help panel; it was added later, so it isn't numbered in its key.
  const steps = ['1', '2', '3', '4', '5', 'Craft', '6', '7']
    .map((key, i) => `${i + 1}. ${phrases[`help.step${key}`]}`)
    .join('\n')
  const md = `<!-- Generated by scripts/readme-stubs.ts from src/i18n/${lang}.json: edit those, then run \`pnpm readmes\`. -->

# Gwent Deck Search

${bar(lang)}

${intro}

**[${open}](${SITE}?lang=${lang})**

![${alt}](screenshots/overview-${lang}.png)

## ${phrases['help.guide']}

${steps}

${full}: [guide.md](guide.md)

> ${machine} [CONTRIBUTING.md](../CONTRIBUTING.md)
`
  writeFileSync(join(ROOT, 'docs', `README.${lang}.md`), md)
}
console.log(`Wrote ${LANGUAGES.length - 1} README stubs`)
