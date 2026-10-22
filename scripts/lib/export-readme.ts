import { CONFIG } from '../../src/config.ts'
import { LANGUAGE_NAMES, LANGUAGES, type Lang } from '../../src/i18n.ts'
import type { manifest } from './export.ts'

type Manifest = ReturnType<typeof manifest>

/** The summary every README has, by language: `{…}` fills in from the manifest. Machine-translated past English. */
const SUMMARY: Record<Lang, { title: string; body: string; files: Record<string, string>; footer: string }> = {
  en: {
    title: 'Gwent Deck Search: deck data',
    body: `The published GWENT decks behind [Gwent Deck Search]({site}), as spreadsheets, for your own analysis. Data from {date}: {decks} decks, {cards} cards.

Decks are guides published on playgwent.com in the last {community} months, and two curated lists, Shinmiri2's and MetallicDanny's (their main lists, and their per-patch tabs from the last {sheets} months). They are not ladder play: there are no win rates.

Provisions are checked against today's card costs; power and ability changes don't show in deck lists. The CSV files are UTF-8 and open in Excel, Google Sheets or LibreOffice.`,
    files: {
      'decks.csv': "one row per deck: faction, leader, provisions against today's limit, source, author, video.",
      'deck-cards.csv': "every deck's cards and copies.",
      'cards.csv': 'every card: stats, tags, how many decks run it, and its name in 11 languages.',
      'card-pairs.csv':
        'cards often played together, and how much more often than chance (lift). Archetypes show up as cards with high lift to each other.',
      'leaders/':
        'a report per leader: its decks, when they were published, and the cards they run, with card names in each language.',
      'manifest.json': 'the date, the collection windows and the counts.',
    },
    footer:
      'The scripts that made this, and more (`pnpm whatif` for Balance Council ballots, `pnpm package` for the decks around any card), are in the repository: [scripts/README.md]({repo}/blob/main/scripts/README.md).',
  },
  de: {
    title: 'Gwent Deck Search: Deckdaten',
    body: `Die veröffentlichten GWENT-Decks hinter [Gwent Deck Search]({site}) als Tabellen für eigene Auswertungen. Daten vom {date}: {decks} Decks, {cards} Karten.

Die Decks sind Guides, die in den letzten {community} Monaten auf playgwent.com veröffentlicht wurden, sowie zwei kuratierte Listen von Shinmiri2 und MetallicDanny (ihre Hauptlisten und ihre Patch-Tabs der letzten {sheets} Monate). Es sind keine Ranglistenpartien: Siegquoten gibt es nicht.

Rekrutierungskosten werden mit den heutigen Kartenkosten verglichen; Änderungen an Stärke und Fähigkeiten sind in Decklisten nicht sichtbar. Die CSV-Dateien sind UTF-8 und lassen sich in Excel, Google Sheets oder LibreOffice öffnen.`,
    files: {
      'decks.csv':
        'eine Zeile pro Deck: Fraktion, Anführer, Rekrutierungskosten gegenüber dem heutigen Limit, Quelle, Autor, Video.',
      'deck-cards.csv': 'die Karten und Kopien jedes Decks.',
      'cards.csv': 'jede Karte: Werte, Tags, in wie vielen Decks sie spielt, und ihr Name in 11 Sprachen.',
      'card-pairs.csv':
        'Karten, die oft zusammen gespielt werden, und wie viel häufiger als zufällig (Lift). Archetypen zeigen sich als Karten mit hohem Lift zueinander.',
      'leaders/':
        'ein Bericht pro Anführer: seine Decks, wann sie veröffentlicht wurden und welche Karten sie spielen, mit Kartennamen in jeder Sprache.',
      'manifest.json': 'Datum, Erfassungszeiträume und Anzahlen.',
    },
    footer:
      'Die Skripte, die das erstellt haben, und mehr (`pnpm whatif` für Balance-Council-Stimmzettel, `pnpm package` für die Decks rund um eine Karte) liegen im Repository: [scripts/README.md]({repo}/blob/main/scripts/README.md).',
  },
  es: {
    title: 'Gwent Deck Search: datos de mazos',
    body: `Los mazos de GWENT publicados que usa [Gwent Deck Search]({site}), en hojas de cálculo, para tus propios análisis. Datos del {date}: {decks} mazos, {cards} cartas.

Los mazos son guías publicadas en playgwent.com en los últimos {community} meses y dos listas seleccionadas, de Shinmiri2 y de MetallicDanny (sus listas principales y sus pestañas por parche de los últimos {sheets} meses). No son partidas clasificatorias: no hay porcentajes de victoria.

Las provisiones se comparan con el coste actual de las cartas; los cambios de poder y de habilidades no se ven en las listas de mazos. Los archivos CSV están en UTF-8 y se abren en Excel, Google Sheets o LibreOffice.`,
    files: {
      'decks.csv': 'una fila por mazo: facción, líder, provisiones frente al límite actual, fuente, autor, vídeo.',
      'deck-cards.csv': 'las cartas y copias de cada mazo.',
      'cards.csv': 'cada carta: estadísticas, etiquetas, en cuántos mazos aparece y su nombre en 11 idiomas.',
      'card-pairs.csv':
        'cartas que suelen jugarse juntas, y cuánto más a menudo que por azar (lift). Los arquetipos aparecen como cartas con un lift alto entre sí.',
      'leaders/':
        'un informe por líder: sus mazos, cuándo se publicaron y qué cartas usan, con los nombres de las cartas en cada idioma.',
      'manifest.json': 'la fecha, los periodos de recogida y los recuentos.',
    },
    footer:
      'Los scripts que lo generan, y más (`pnpm whatif` para papeletas del Balance Council, `pnpm package` para los mazos en torno a una carta), están en el repositorio: [scripts/README.md]({repo}/blob/main/scripts/README.md).',
  },
  fr: {
    title: 'Gwent Deck Search : données des decks',
    body: `Les decks GWENT publiés qu'utilise [Gwent Deck Search]({site}), sous forme de tableurs, pour vos propres analyses. Données du {date} : {decks} decks, {cards} cartes.

Les decks sont des guides publiés sur playgwent.com au cours des {community} derniers mois, ainsi que deux listes sélectionnées, celles de Shinmiri2 et de MetallicDanny (leurs listes principales et leurs onglets par patch des {sheets} derniers mois). Ce ne sont pas des parties classées : il n'y a pas de taux de victoire.

Les provisions sont comparées au coût actuel des cartes ; les changements de puissance et de capacités ne se voient pas dans les listes. Les fichiers CSV sont en UTF-8 et s'ouvrent dans Excel, Google Sheets ou LibreOffice.`,
    files: {
      'decks.csv':
        'une ligne par deck : faction, chef, provisions par rapport à la limite actuelle, source, auteur, vidéo.',
      'deck-cards.csv': 'les cartes et exemplaires de chaque deck.',
      'cards.csv':
        'chaque carte : caractéristiques, étiquettes, nombre de decks qui la jouent et son nom en 11 langues.',
      'card-pairs.csv':
        'les cartes souvent jouées ensemble, et combien plus souvent que le hasard (lift). Les archétypes apparaissent comme des cartes au lift élevé entre elles.',
      'leaders/':
        'un rapport par chef : ses decks, leur date de publication et les cartes qu’ils jouent, avec le nom des cartes dans chaque langue.',
      'manifest.json': 'la date, les périodes de collecte et les totaux.',
    },
    footer:
      "Les scripts qui l'ont produit, et plus (`pnpm whatif` pour les bulletins du Balance Council, `pnpm package` pour les decks autour d'une carte), sont dans le dépôt : [scripts/README.md]({repo}/blob/main/scripts/README.md).",
  },
  it: {
    title: 'Gwent Deck Search: dati dei mazzi',
    body: `I mazzi di GWENT pubblicati usati da [Gwent Deck Search]({site}), come fogli di calcolo, per le tue analisi. Dati del {date}: {decks} mazzi, {cards} carte.

I mazzi sono guide pubblicate su playgwent.com negli ultimi {community} mesi e due liste curate, di Shinmiri2 e di MetallicDanny (le loro liste principali e le schede per patch degli ultimi {sheets} mesi). Non sono partite classificate: non ci sono percentuali di vittoria.

Le provviste sono confrontate con il costo attuale delle carte; le modifiche a forza e abilità non si vedono nelle liste dei mazzi. I file CSV sono in UTF-8 e si aprono con Excel, Google Sheets o LibreOffice.`,
    files: {
      'decks.csv':
        'una riga per mazzo: fazione, comandante, provviste rispetto al limite attuale, fonte, autore, video.',
      'deck-cards.csv': 'le carte e le copie di ogni mazzo.',
      'cards.csv': 'ogni carta: statistiche, tag, in quanti mazzi è giocata e il suo nome in 11 lingue.',
      'card-pairs.csv':
        'carte giocate spesso insieme, e quanto più spesso del caso (lift). Gli archetipi emergono come carte con lift alto tra loro.',
      'leaders/':
        'un rapporto per comandante: i suoi mazzi, quando sono stati pubblicati e le carte che usano, con i nomi delle carte in ogni lingua.',
      'manifest.json': 'la data, i periodi di raccolta e i conteggi.',
    },
    footer:
      'Gli script che lo generano, e altro (`pnpm whatif` per le schede del Balance Council, `pnpm package` per i mazzi attorno a una carta), sono nel repository: [scripts/README.md]({repo}/blob/main/scripts/README.md).',
  },
  ja: {
    title: 'Gwent Deck Search：デッキデータ',
    body: `[Gwent Deck Search]({site}) が使っている公開済みの GWENT デッキを、分析用のスプレッドシートにしたものです。データ日付：{date}、デッキ {decks} 件、カード {cards} 枚。

デッキは、過去 {community} か月に playgwent.com で公開されたガイドと、Shinmiri2 と MetallicDanny の 2 つの厳選リスト（メインリストと、過去 {sheets} か月のパッチ別タブ）です。ランク戦のデータではないため、勝率はありません。

コストは現在のカードのコストと比較しています。パワーや能力の変更はデッキリストには表れません。CSV ファイルは UTF-8 で、Excel、Google スプレッドシート、LibreOffice で開けます。`,
    files: {
      'decks.csv': '1 行 1 デッキ：勢力、リーダー、現在の上限に対するコスト、出典、作者、動画。',
      'deck-cards.csv': '各デッキのカードと枚数。',
      'cards.csv': '全カード：ステータス、タグ、採用デッキ数、11 言語でのカード名。',
      'card-pairs.csv':
        'よく一緒に使われるカードの組と、偶然に比べてどれだけ多いか（リフト）。アーキタイプは互いのリフトが高いカード群として現れます。',
      'leaders/': 'リーダーごとのレポート：そのデッキ、公開時期、使われているカード（カード名は各言語）。',
      'manifest.json': '日付、収集期間、件数。',
    },
    footer:
      'これを作成したスクリプトなど（バランス評議会の投票用の `pnpm whatif`、任意のカードを中心としたデッキ用の `pnpm package`）はリポジトリにあります：[scripts/README.md]({repo}/blob/main/scripts/README.md)。',
  },
  ko: {
    title: 'Gwent Deck Search: 덱 데이터',
    body: `[Gwent Deck Search]({site})가 사용하는 공개된 궨트 덱을 직접 분석할 수 있도록 스프레드시트로 정리했습니다. 데이터 날짜: {date}, 덱 {decks}개, 카드 {cards}장.

덱은 지난 {community}개월 동안 playgwent.com에 공개된 가이드와, Shinmiri2와 MetallicDanny의 엄선된 목록 두 가지(메인 목록과 지난 {sheets}개월의 패치별 탭)입니다. 랭크 게임 데이터가 아니므로 승률은 없습니다.

보급량은 현재 카드 비용 기준으로 확인합니다. 전력과 능력 변경은 덱 목록에 나타나지 않습니다. CSV 파일은 UTF-8이며 Excel, Google 스프레드시트, LibreOffice에서 열 수 있습니다.`,
    files: {
      'decks.csv': '덱마다 한 줄: 세력, 지도자, 현재 한도 대비 보급량, 출처, 작성자, 영상.',
      'deck-cards.csv': '각 덱의 카드와 장수.',
      'cards.csv': '모든 카드: 능력치, 태그, 사용하는 덱 수, 11개 언어로 된 카드 이름.',
      'card-pairs.csv':
        '함께 자주 쓰이는 카드 쌍과, 우연보다 얼마나 더 자주인지(리프트). 아키타입은 서로 리프트가 높은 카드들로 드러납니다.',
      'leaders/': '지도자별 보고서: 덱, 공개 시기, 사용하는 카드(카드 이름은 언어별).',
      'manifest.json': '날짜, 수집 기간, 개수.',
    },
    footer:
      '이 자료를 만든 스크립트와 그 밖의 도구(밸런스 위원회 투표용 `pnpm whatif`, 특정 카드 중심의 덱을 보는 `pnpm package`)는 저장소에 있습니다: [scripts/README.md]({repo}/blob/main/scripts/README.md).',
  },
  pl: {
    title: 'Gwent Deck Search: dane talii',
    body: `Opublikowane talie GWINTA, z których korzysta [Gwent Deck Search]({site}), w postaci arkuszy do własnych analiz. Dane z {date}: {decks} talii, {cards} kart.

Talie to poradniki opublikowane na playgwent.com w ciągu ostatnich {community} miesięcy oraz dwie wyselekcjonowane listy, Shinmiri2 i MetallicDanny (ich listy główne i zakładki dla poszczególnych łatek z ostatnich {sheets} miesięcy). To nie są gry rankingowe: nie ma współczynników zwycięstw.

Koszt jest porównywany z obecnym kosztem kart; zmiany siły i zdolności nie są widoczne w listach talii. Pliki CSV są w UTF-8 i otwierają się w Excelu, Arkuszach Google lub LibreOffice.`,
    files: {
      'decks.csv': 'jeden wiersz na talię: frakcja, dowódca, koszt względem obecnego limitu, źródło, autor, wideo.',
      'deck-cards.csv': 'karty i liczba kopii w każdej talii.',
      'cards.csv': 'każda karta: statystyki, tagi, w ilu taliach występuje i jej nazwa w 11 językach.',
      'card-pairs.csv':
        'karty często grane razem i o ile częściej niż przypadkowo (lift). Archetypy widać jako karty o wysokim lifcie względem siebie.',
      'leaders/':
        'raport dla każdego dowódcy: jego talie, kiedy je opublikowano i jakie karty grają, z nazwami kart w każdym języku.',
      'manifest.json': 'data, okresy zbierania i liczby.',
    },
    footer:
      'Skrypty, które to utworzyły, i więcej (`pnpm whatif` dla kart do głosowania Balance Council, `pnpm package` dla talii wokół dowolnej karty) są w repozytorium: [scripts/README.md]({repo}/blob/main/scripts/README.md).',
  },
  'pt-BR': {
    title: 'Gwent Deck Search: dados dos baralhos',
    body: `Os baralhos de GWENT publicados que o [Gwent Deck Search]({site}) usa, em planilhas, para suas próprias análises. Dados de {date}: {decks} baralhos, {cards} cartas.

Os baralhos são guias publicados no playgwent.com nos últimos {community} meses e duas listas selecionadas, de Shinmiri2 e de MetallicDanny (as listas principais e as abas por patch dos últimos {sheets} meses). Não são partidas ranqueadas: não há taxas de vitória.

As provisões são comparadas com o custo atual das cartas; mudanças de poder e de habilidades não aparecem nas listas de baralhos. Os arquivos CSV estão em UTF-8 e abrem no Excel, no Google Sheets ou no LibreOffice.`,
    files: {
      'decks.csv': 'uma linha por baralho: facção, líder, provisões em relação ao limite atual, fonte, autor, vídeo.',
      'deck-cards.csv': 'as cartas e cópias de cada baralho.',
      'cards.csv': 'cada carta: atributos, tags, em quantos baralhos aparece e seu nome em 11 idiomas.',
      'card-pairs.csv':
        'cartas jogadas juntas com frequência, e quanto mais que o acaso (lift). Os arquétipos aparecem como cartas com lift alto entre si.',
      'leaders/':
        'um relatório por líder: seus baralhos, quando foram publicados e as cartas que usam, com os nomes das cartas em cada idioma.',
      'manifest.json': 'a data, os períodos de coleta e as contagens.',
    },
    footer:
      'Os scripts que geraram isto, e mais (`pnpm whatif` para cédulas do Balance Council, `pnpm package` para os baralhos em torno de uma carta), estão no repositório: [scripts/README.md]({repo}/blob/main/scripts/README.md).',
  },
  ru: {
    title: 'Gwent Deck Search: данные колод',
    body: `Опубликованные колоды ГВИНТА, которые использует [Gwent Deck Search]({site}), в виде таблиц для собственного анализа. Данные от {date}: {decks} колод, {cards} карт.

Колоды — это гайды, опубликованные на playgwent.com за последние {community} месяцев, и два отобранных списка, Shinmiri2 и MetallicDanny (их основные списки и вкладки по патчам за последние {sheets} месяцев). Это не рейтинговые игры: процента побед нет.

Стоимость сравнивается с нынешней стоимостью карт; изменения силы и способностей в списках колод не видны. CSV-файлы в кодировке UTF-8 открываются в Excel, Google Таблицах или LibreOffice.`,
    files: {
      'decks.csv':
        'по строке на колоду: фракция, лидер, стоимость относительно нынешнего лимита, источник, автор, видео.',
      'deck-cards.csv': 'карты и число копий в каждой колоде.',
      'cards.csv': 'все карты: характеристики, теги, в скольких колодах играют и название на 11 языках.',
      'card-pairs.csv':
        'карты, которые часто играют вместе, и во сколько раз чаще случайного (lift). Архетипы видны как карты с высоким lift друг к другу.',
      'leaders/':
        'отчёт по каждому лидеру: его колоды, когда они опубликованы и какие карты в них играют, с названиями карт на каждом языке.',
      'manifest.json': 'дата, периоды сбора и количества.',
    },
    footer:
      'Скрипты, которые это создали, и другие (`pnpm whatif` для бюллетеней Balance Council, `pnpm package` для колод вокруг любой карты) лежат в репозитории: [scripts/README.md]({repo}/blob/main/scripts/README.md).',
  },
  'zh-cn': {
    title: 'Gwent Deck Search：卡组数据',
    body: `[Gwent Deck Search]({site}) 所用的已发布《巫师之昆特牌》卡组，整理为表格，供你自行分析。数据日期：{date}，共 {decks} 套卡组、{cards} 张卡牌。

卡组来自过去 {community} 个月在 playgwent.com 发布的攻略，以及 Shinmiri2 和 MetallicDanny 的两份精选列表（主列表，以及过去 {sheets} 个月按版本划分的标签页）。这些不是天梯对局数据，因此没有胜率。

费用按当前卡牌费用核对；战力和能力的改动无法从卡组列表中看出。CSV 文件为 UTF-8 编码，可用 Excel、Google 表格或 LibreOffice 打开。`,
    files: {
      'decks.csv': '每套卡组一行：阵营、领袖、相对于当前上限的费用、来源、作者、视频。',
      'deck-cards.csv': '每套卡组的卡牌及张数。',
      'cards.csv': '所有卡牌：属性、标签、被多少卡组使用，以及 11 种语言的卡牌名称。',
      'card-pairs.csv': '经常一起使用的卡牌组合，以及比随机情况高出多少（提升度）。流派表现为彼此提升度高的一组卡牌。',
      'leaders/': '每位领袖一份报告：其卡组、发布时间以及使用的卡牌（卡牌名称提供各语言版本）。',
      'manifest.json': '日期、收集期限和数量。',
    },
    footer:
      '生成这些数据的脚本及更多工具（用于平衡委员会投票的 `pnpm whatif`、查看围绕任意卡牌的卡组的 `pnpm package`）位于仓库中：[scripts/README.md]({repo}/blob/main/scripts/README.md)。',
  },
}

/** The English README's column reference, which every other language links to. */
const COLUMNS = `## Columns

### decks.csv

| Column | Meaning |
|---|---|
| deck_id | playgwent's deck hash; joins with deck-cards.csv |
| url | The deck or guide on playgwent.com |
| name, original_name, original_lang | The name in English; the author's own name and language, when it wasn't English |
| faction, leader_id, leader, stratagem_id, stratagem | Faction code (MO, NG, NR, SK, ST, SY), leader and stratagem |
| cards, units | Cards besides leader and stratagem, and how many are units |
| provisions_used, provision_limit, provisions_spare | Today's costs; the limit is 150 + the leader's bonus; spare is negative when over |
| provision_status | spare, exact or over |
| scraps | Crafting cost of the deck |
| sources | community, shinmiri2, metallic-danny; several when lists share the deck |
| author, votes, guide_updated, guide_lang | For community guides |
| video_url, video_lang | A gameplay video the source links |
| same_list_as | The first deck with exactly this card list, for duplicates |

### deck-cards.csv

deck_id, card_id, card (English name), copies, role (leader, stratagem or card).

### cards.csv

| Column | Meaning |
|---|---|
| card_id, faction, secondary_faction, type, rarity | NE is neutral; a dual-faction card has a secondary faction |
| provisions, power, craft_scraps | Today's values; a leader's provisions are its bonus |
| tags, tag_names | Deck-builder tags: keys (c63 is a category, e.g. Dragon) and English names |
| decks, decks_that_could, share | Decks running the card, out of the decks that could (its faction's, or every deck for a neutral) |
| name_en … name_zh-cn | The card's name in each language |

### card-pairs.csv

Pairs in at least {minPair} decks together (stratagems aside). decks_a and decks_b count the decks that could run both
(the faction's, for a faction card). share_of_a is the share of A's decks that also run B. lift is
together × decks / (decks_a × decks_b): 1 is chance, 5 means five times more often than chance.

### leaders/

One Markdown report per leader with decks, in leaders/<language>/ (card names in that language beside the English;
the rest is in English): its decks within today's limit and with a video, decks per half-year (sheet decks are
undated), and the cards that go with it, ranked by lift.
`

/**
 * The export's README in a language: a summary (machine-translated past English), language links, and, in English,
 * the column reference.
 *
 * @param lang - The language
 * @param m - The export's manifest
 * @returns Markdown
 */
export function exportReadme(lang: Lang, m: Manifest): string {
  const fill = (text: string) =>
    text
      .replaceAll('{site}', CONFIG.siteUrl)
      .replaceAll('{repo}', CONFIG.repoUrl)
      .replaceAll('{date}', m.data_from.slice(0, 10))
      .replaceAll('{decks}', String(m.decks))
      .replaceAll('{cards}', String(m.cards))
      .replaceAll('{community}', String(m.windows.community_guides_months))
      .replaceAll('{sheets}', String(m.windows.sheet_patch_tabs_months))
      .replaceAll('{minPair}', String(m.min_pair_decks))
  const file = (l: Lang) => (l === 'en' ? 'README.md' : `README.${l}.md`)
  const links = LANGUAGES.map((l) => (l === lang ? `**${LANGUAGE_NAMES[l]}**` : `[${LANGUAGE_NAMES[l]}](${file(l)})`))
  const s = SUMMARY[lang]
  return fill(
    [
      `# ${s.title}`,
      '',
      links.join(' · '),
      '',
      s.body,
      '',
      ...Object.entries(s.files).map(([name, text]) => `- **${name}**: ${text}`),
      '',
      s.footer,
      '',
      lang === 'en' ? COLUMNS : `[${COLUMNS_LINK[lang]}](README.md#columns)\n\n> ${MACHINE[lang]}`,
      '',
    ].join('\n'),
  )
}

/** "Column details (English)", by language. */
const COLUMNS_LINK: Record<Exclude<Lang, 'en'>, string> = {
  de: 'Spalten im Detail (Englisch)',
  es: 'Detalle de las columnas (en inglés)',
  fr: 'Détail des colonnes (en anglais)',
  it: 'Dettaglio delle colonne (in inglese)',
  ja: '列の詳細（英語）',
  ko: '열 상세 설명(영어)',
  pl: 'Opis kolumn (po angielsku)',
  'pt-BR': 'Detalhes das colunas (em inglês)',
  ru: 'Описание столбцов (на английском)',
  'zh-cn': '各列说明（英文）',
}

/** "This page is machine-translated; corrections are welcome", by language. */
const MACHINE: Record<Exclude<Lang, 'en'>, string> = {
  de: 'Diese Seite wurde maschinell übersetzt. Korrekturen sind willkommen.',
  es: 'Esta página se tradujo automáticamente. Las correcciones son bienvenidas.',
  fr: 'Cette page a été traduite automatiquement. Les corrections sont les bienvenues.',
  it: 'Questa pagina è stata tradotta automaticamente. Le correzioni sono benvenute.',
  ja: 'このページは機械翻訳です。修正を歓迎します。',
  ko: '이 페이지는 기계 번역되었습니다. 수정은 언제나 환영합니다.',
  pl: 'Ta strona została przetłumaczona maszynowo. Poprawki są mile widziane.',
  'pt-BR': 'Esta página foi traduzida automaticamente. Correções são bem-vindas.',
  ru: 'Эта страница переведена автоматически. Исправления приветствуются.',
  'zh-cn': '本页为机器翻译，欢迎指正。',
}
