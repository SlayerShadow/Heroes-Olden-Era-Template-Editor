# Glossary

The manual follows one rule: one concept — one term, the same across all chapters. This chapter collects the definitions of the terms in one place — refer to it to decode an unfamiliar word in the text or clarify the meaning of a setting.

The entries are arranged in English alphabetical order. The heading is the term in the form it occurs throughout the manual; below it is the definition, and often a link to the chapter with the detailed breakdown. Similarly named but different concepts carry a “do not confuse” note. The effect of some settings has not been fully studied — such entries do not guess the meaning but say it straight: *Purpose to be confirmed.*

## A

### Active variant

The layout variant currently shown on the canvas and receiving all the edits: zones, connections, Inspector fields. Opening a file and the “New” button activate the first variant. Switching variants does not land in the undo history.

More details — [Variants: management and selection](variant-manage.md).

### Ambient pickup

A small resource that the generator scatters across the zone. The placement is set by the parameters of the layout’s “Ambient pickups” block (`ambientPickupDistribution`): repulsion, noise, attraction to roads and obstacles, and the group size weights.

More details — [Template settings (root)](root.md).

## B

### Banned buildings list

The enumeration of the buildings that the city will not be able to build; in the file — `buildingsBanSid`. Its name is picked from the game database’s catalog; the validator marks an unfamiliar name with a warning — the mechanics are the same as the construction preset’s.

More details — [Zone main objects](main-objects.md).

### Base variant (A)

The active variant in the role of the comparison base: it is shown on the canvas, receives the edits, and the differences are computed relative to it. A click on a difference row focuses its element — the Inspector opens, and the camera points at the zone or the connection. The role is firmly bound to the active variant: whichever variant becomes active is the one that becomes A.

More details — [Variant comparison](compare.md).

### Biome

The landscape type of the zone on the finished map. There are seven biomes: “Snow”, “Grass”, “Dirt”, “Autumn”, “Lava”, “Deathland”, and “Sand”.

More details — [Zone: all properties](zone.md).

### Biome layer

One of the zone’s three independent biome settings: `zoneBiome` — surface, `contentBiome` — content, `metaObjectsBiome` — environment decorations. In the canvas’s “Biomes” mode, the “biome layer” toggle picks which of the three settings the node fills show.

More details — [Zone: all properties](zone.md).

### Biome selection mode

The setting of the biome selector in the zone’s Inspector: “from list” (FromList), “same as another zone” (MatchZone), or “same as the main object” (MatchMainObject). All three biome layers share the same set of modes.

More details — [Zone: all properties](zone.md).

### Broken reference

A reference by name to an element that is not in the template or the catalog: a group, a connection, a zone, a layout, a pool, a list. The validator marks it with an issue — for road ends and connection ends it is an error; a zone’s chip with an unfamiliar name gets the “not found” badge.

More details — [Template validation (validator)](validator.md).

## C

### Canvas

The central area of the editor window, with the diagram of the active variant’s zones and connections. Six view modes color the same diagram; the mode buttons stand above it. In the bottom right corner — the minimap; a right click opens the context menu.

More details — [Interface: windows and panels](interface.md).

### “Changes not applied” status

A mark under the JSON block’s field: it appears while the typed text differs from the current state of the element, and disappears after “Apply” or “Reset”. Do not confuse it with the window’s status bar — the permanent hint along the bottom edge.

More details — [Direct JSON editing](json-editor.md).

### Chip

A small counter in the header or the body of a panel: a number with an icon, a tooltip on hover. With a zero, the chip looks muted.

### Choice group

A mandatory content item without a `sid`: its contents are set by lists from the database (`includeLists`) and/or by weighted choice variants — the nested `content[]` list. In the UI it is marked with the “choice” kind chip; an item without a sid and without lists becomes a dead entry, which the validator warns about. Do not confuse it with the choice variant and the layout variant.

More details — [Template settings (root)](root.md).

### Choice variant

A record of the root’s “Choice variants” section: an object (`sid`), an object variant, and a weight. The generator picks from such candidates by weights when placing; a weight of 0 disables the variant. Do not confuse it with the layout variant: the choice variant picks a variant of the object, not an arrangement of zones.

More details — [Template settings (root)](root.md).

### Compared variant (B)

The variant picked in the “B (compare)” selector. It takes part only in computing the differences and is not shown on the canvas.

More details — [Variant comparison](compare.md).

### Comparison badge

A mark next to the element’s name in the Inspector’s header: “≠ V{n}: field summary” (amber) or “missing in V{n}” (reddish), where V{n} is the number of the compared variant B. It shows only with a selected comparison pair, when B differs from A and an element of variant A is selected.

More details — [Variant comparison](compare.md).

### Comparison pair

The two variants picked for comparison: the base A and the compared B. They are picked on the “Compare” tab of the bottom panel; A is always the active variant, shown on the canvas and receiving the edits, while B takes part only in computing the differences. The pair is not written to the files and does not land in the undo history.

More details — [Variant comparison](compare.md).

### Comparison selection

A set of 2–6 pools for the catalog’s “Compare” tab: the “Comparison N/6” label, the chips with “✕”, and the “add by name…” field. The field works as a switcher — the name of an already selected pool removes it from the set, an unknown name is ignored. Selected pools stay in the table regardless of the filters; the selection is remembered between openings of the catalog, and “Reset” clears it.

More details — [Content pool catalog](pools.md).

### Connection

A transition between two zones (a corridor, a portal, adjacency, and others). Connections live inside a layout variant: every variant has its own list of connections.

More details — [Connections between zones](connections.md).

### Connection auto name

A name of the From-To kind, assembled from the names of the connection’s zones — for example, “Zone-1-Zone-2”. It lives while the “Connection name” field is empty: under it the connection is visible in the template tree, and the road ends and the “on a specific connection” placement arguments reference it. Renaming a zone changes it by a cascade, together with all the references.

More details — [Connections between zones](connections.md).

### Connection duplication

A copy of a connection with ready-made settings: it is created by the copy button in the Inspector’s header (the tooltip “Duplicate connection”) or by the “Duplicate connection” item of the context menu — of the line on the canvas or of the connection row in the template tree. It inherits all the fields of the original connection — the type, the connection road, the guard strength and increment, the guard zone, the synchronized guard group. The copy gets a name with the -N suffix, lands right after the original, is selected, and rolls back with Ctrl+Z.

More details — [Canvas: graph editing](canvas-editing.md).

### Connection road

A road along the transition between two zones; enabled by the connection’s `road` flag in the Inspector’s “Road and simulation” section. Not the zone road — that one describes the routes inside the zone.

More details — [Connections between zones](connections.md).

### Connector zone

A zone without budgets and main objects; another mark of such a zone is a name starting with “Connector”. On the canvas, the connector zone is shown with a flat dark fill and the connector mark.

### Construction preset

A named scheme of the city’s buildings that are built by the start of the game. In the file — `buildingsConstructionSid`; the name is picked from the game database’s catalog, and the validator marks an unfamiliar name with a warning.

More details — [Zone main objects](main-objects.md).

### Content budget

The amount of value that the generator will place in the zone as content. Set by an absolute number or per area (PerArea); by content kind there are three budgets — guarded content, unguarded content, and resources.

More details — [Zone: all properties](zone.md).

### Content list

A named enumeration of sids inside the game database’s pools. Pools attach lists to their groups, and different pools use the same list.

More details — [Content pool catalog](pools.md).

### Content pool

A named set of game objects from which the generator takes the zone’s filling: until the content budget is exhausted, the generator picks objects from the pools recorded in the zone. The template stores only the pool names; the pools themselves live in the game database.

More details — [Content pool catalog](pools.md).

### Context menu

A list of actions at the cursor point on a right click: on an empty spot of the canvas, a zone node, a connection line, a zone or connection row of the template tree. The items run immediately, without a confirmation dialog; the delete items are marked red. It closes by picking an item, pressing Esc, or clicking away from it, and an action for a row from another variant first makes that variant active.

More details — [Canvas: graph editing](canvas-editing.md).

### Count limits

Groups of restrictions on the number of objects for zones: a zone attaches a group by name, and the group caps the number of objects of one kind or one class. A limit value of 0 bans the object completely in the zones of that group.

More details — [Template settings (root)](root.md).

### Crossroads

The point where the zone’s roads meet. Its position is set by the `crossroadsPosition` field — a number from 0 to 1; the editor phrases the meaning of the scale’s ends as a hypothesis: 0 — the crossroads at the zone center, 1 — at the edge. *Purpose to be confirmed.* In the canvas’s “Roads” mode, the set value is shown by the “✕NN%” label on the node, and the road ends aimed at the crossroads are marked with ◆.

More details — [Zone: all properties](zone.md).

## D

### Demo template

The “Sample Editor” tutorial template — the running example of the manual’s reference chapters. It does not ship with the editor or the game, and its numbers illustrate the mechanics of the fields rather than set a norm: you will see the same fields when you open any official template — the values will be different.

More details — [Editor overview](review.md).

### Displayed win condition

The value of the `displayWinCondition` field of the “Basics” section: the win condition that the game shows the players as the goal of the game. By itself it does not turn on the mechanic — the real rules are set by the `winConditions` toggles of the “Game rules” section. Match the displayed condition to the enabled toggles, otherwise the announcement of the game diverges from the actual game.

More details — [Template settings (root)](root.md).

## E

### Edge noise

An element of the map border’s `obstaclesNoise`/`waterNoise` list — an “amplitude + frequency” pair that makes the edge of the ring ragged instead of an even line.

More details — [Variant: orientation and border](variant-layout.md).

### Elevation mode

An element of the zone layout’s `elevationModes` list: the weight and the bounds of the elevated terrain share. The weight sets how often the generator picks the mode, and 0 disables it. Fraction bounds describe the terrain: 0–0 — a flat zone, 0.2–0.4 ≈ hills, 0.6–0.8 ≈ mountains.

More details — [Template settings (root)](root.md).

### Encounter

A ready-made “micro-map” of objects and guards. The generator picks encounters automatically by type and size; the template does not reference them.

More details — [Editor overview](review.md).

## F

### Field summary

A single-line list of the diverged fields of a zone or connection, of the form `size: 1 → 1.5, roads: 0 → 2`. Shown in the difference row, in the row’s tooltip, and in the comparison badge.

More details — [Variant comparison](compare.md).

### Filter chip

A clickable toggle chip in the filter band of the content pool catalog: a `t0`–`t5` tier or a random pool profile. An enabled chip leaves the rows with this value; several chips of one band work as “or”. Tiers and profiles exist only for random and classic pools, so an enabled chip hides the other families from the list. Do not confuse it with a tag of the pool name.

More details — [Content pool catalog](pools.md).

### “First Duel”

The tutorial exercise template of the “My first template” chapter: a random map for two players. It has three zones (`Spawn-1`, `Spawn-2`, `Center`) and four connections — the main ones with a guard value of 30,000 and the secondary ones with 12,000 for each pair; one layout variant V1, a 128×128 map. Its numbers are the author’s example, not a norm of the game.

More details — [My first template](first-template.md).

## G

### Gate escape rules

The pair of lists, `portalPlacementRulesFrom` and `portalPlacementRulesTo`, on a portal connection: the first answers “where the gates lead”, the second — “where their entry points are”. You can fill in one list or both. The rules are assembled from cards whose format is shared with the placement rules of mandatory content.

More details — [Connections between zones](connections.md).

### Global ban

A record in one of the four lists (`magics`, `items`, `skills`, `heroes`) of the root’s `globalBans` section. It bans a game database entry — a spell, an artifact, a skill, or a hero — on the whole map and in all layout variants. Do not confuse it with count limits: those restrict the number of objects only in the zones that reference them.

More details — [Template settings (root)](root.md).

### Guard

The protection of content and transitions; set by the guard value.

### Guard value

A number in value units that sets the strength of the guard protecting content or a transition between zones. In the file — the `guardValue` field: connections, main objects, mandatory content items, and object overrides carry it. On the canvas badges, a large value is compressed to a compact form like “30k”.

More details — [Connections between zones](connections.md).

## H

### Hero spawn point

The player’s starting main object (Spawn) in the zone. On the canvas, the node carrying it is painted in the player’s color, and the legend labels it “Players (Spawn)”.

More details — [Zone main objects](main-objects.md).

### Hire tier

The number of the external hire building — from 1 to 7 (`random_hire_1`–`random_hire_7`). In the initial and weekly increment arrays of the zone’s “External hire” section, the index of the element is one less than the tier number: the element at index 0 configures `random_hire_1`, the element at index 6 — `random_hire_7`.

More details — [Zone: all properties](zone.md).

### Hole

A gap inside an encounter: an “eaten” pickup slot, where an object should have appeared, or an encounter tile. The mechanic is enabled by the “Encounter ‘holes’” game rule (`gameRules.encounterHoles`), and the zone’s shares set which part of the encounters gets a hole and which part gets two. This is a content layout parameter: it decides which part of the encounters’ content does not make it onto the map.

More details — [Zone: all properties](zone.md).

## I

### Inline entry

An object written directly into the pool’s group (`content[]`). The entry overrides the weight of the same-name sid that came from the group’s lists: a weight of 0 disables the object without deleting it.

More details — [Content pool catalog](pools.md).

### Inspector

The right panel of the editor window: shows the properties of the selected zone, connection, template, or active variant. Its set of tabs — “Inspector”, “Content”, “Limits”, “Template”, “Variant” — does not depend on the selection; only the contents of the “Inspector” tab change.

More details — [Interface: windows and panels](interface.md).

### Issue

A single find of the validator: the severity (error, warning, info), the area (root, map size, variant, zone, connection, guard group, road, group name), the text, and the path to a field in the `.rmg.json` file. Issues are collected on the “Issues” panel.

More details — [Template validation (validator)](validator.md).

## J

### JSON block

A text block for the direct editing of an element’s record: a field with the JSON text, the “Apply” and “Reset” buttons, the “changes not applied” status. The editor has three blocks: the zone’s and the connection’s — the expandable “JSON” block under the property sections of the “Inspector” tab — and the template’s (the root’s JSON block).

More details — [Direct JSON editing](json-editor.md).

### JSON draft

The unapplied text of a JSON block. Until “Apply”, the template does not change, and the text is lost when you leave the tab. A draft error is visible as a row on the “Issues” panel and blocks the “Save” button.

More details — [Direct JSON editing](json-editor.md).

## K

### Known broken reference (stock)

The orange badge of the “Construction preset” field in the main object card: the name is missing from the game’s catalog but is one of the five known broken references of stock templates — the game tolerates them silently. It distinguishes a known name from any unfamiliar one — that one gets the red “not in catalog” badge — while the text of the validator’s warning is the same in both cases.

More details — [Template validation (validator)](validator.md).

## L

### Layout variant

One arrangement of zones and connections inside the template; in the file — an element of the `variants[]` list. When creating a map, the game builds it from a single variant, which the generator picks at random; in the interface — “Variant”.

More details — [Variants: management and selection](variant-manage.md).

### Legend

A tab of the left panel: decodes the colors, lines, and icons with which the canvas draws the diagram in the current view mode. The set of Legend sections changes along with the mode.

More details — [Interface: windows and panels](interface.md).

## M

### Main object

Anchor point of the zone: a city, a hero spawn point, an abandoned outpost, or a Hell Light Arena. The generator builds the zone around the main objects, and the other settings reference them by number — the road ends, the “same as the main object” biome layer, the “Match” faction selection mode.

More details — [Zone main objects](main-objects.md).

### Mandatory content

Groups of objects that the generator must place on the map. The budgets collect random filling, while a group gives a guarantee: the zone attaches it by name, and the group’s objects land on the map regardless of the budgets. Such groups live in the template’s root and apply equally to all layout variants.

More details — [Template settings (root)](root.md).

### Mine

A mandatory content item with the “Resource generator” toggle enabled — this is what the `isMine` field is called in the file. The generator takes this mark into account when arranging objects, and in the canvas’s “Content” mode the item’s dot is outlined with a rectangle.

More details — [Template settings (root)](root.md).

### Minimap

A reduced diagram of the active variant in the bottom right corner of the canvas; its colors follow the active view mode. Clicking the minimap or dragging the cursor across moves the view of the diagram. The preview dialog’s minimap is a different picture: it is built by the fixed rules of “Overview” and goes into the PNG.

More details — [Interface: windows and panels](interface.md).

## O

### Object override

A record of the template’s root `valueOverrides` list: an object (`sid`), an object variant (`variant`, −1 means “all variants”), and a guard value (`guardValue`). It overrides the price and the guards of an object from the game database. In the editor, the entry is an expanding card in the “Object overrides (valueOverrides)” section of the “Template” tab.

More details — [Template settings (root)](root.md).

## P

### Packing mode

The way the variant’s zone layout is fit into the map square (`orientation.mode`). Its list offers two values: “Minimal bounding square” and “Bounding circle”.

More details — [Variant: orientation and border](variant-layout.md).

### Parallel connection

A second and any following connection between the same pair of zones. The first connection of the pair stays unnamed and is addressed by the From-To auto name made of the zone names; the following ones get a From-To-N name. Created by dragging again from the right edge of a zone onto another zone or by connection duplication, and “Delete connection” removes exactly one connection of the pair.

More details — [Canvas: graph editing](canvas-editing.md).

### Placement rule

A record of the mandatory content item’s `rules[]` list: the type (Road, MainObject, Crossroads, Sid, or Connection — what to place relative to), the target arguments, the target distance band `targetMin`–`targetMax` in fractions of the zone radius, and the weight — it decides the competition of the rules. In the canvas’s “Content” mode, the rule is drawn as a ring around the target; the card format is shared with the gate escape rules.

More details — [Template settings (root)](root.md).

### Pool ban

A ban on an object at the pool level: the `bans` list stores the sids that will not make it into the zone’s filling even if they are part of the pool’s attached lists. Do not confuse it with the global ban — that one bans a game database entry on the whole map, not inside a single pool.

More details — [Content pool catalog](pools.md).

### Pool chip

An element of the Inspector’s pool list field: the pool’s label and the ✕ button that removes it. The chip’s tooltip shows the original name and the tags.

More details — [Zone: all properties](zone.md).

### Portal gates

The pair of gates with which a portal connects zones. Their placement is set by the fields of the connection’s “Portal gates” section — “Gate placement” (`gatePlacement`) and “Gate zone” (`gatePlacementArgs`).

More details — [Connections between zones](connections.md).

### Preview

A PNG image of the active variant’s minimap, 700×700 pixels in size. The editor saves the preview together with the template and can also hand over the file separately.

More details — [Preview and PNG](preview.md).

### Profile folder

The game’s folder of a Windows user: `...\AppData\LocalLow\Unfrozen\HeroesOldenEra\users\Steam_<id>\`. In its `my_map_templates` subfolder the game reads custom templates — this is the official installation place, while `downloads\map_templates` receives downloads from Steam Workshop.

More details — [Installing a template into the game](install.md).

## R

### Random pool profile

One of the eight thematic biases of a random pool (`base`, `item`, `pandora`, `hire`, `unit_bank`, `res_bank`, `stat`, `magic`). In a profile pool, the weight of “its own” content group is noticeably higher than in the base pool of the same tier.

More details — [Content pool catalog](pools.md).

### Random pool tier

The `t0`–`t5` mark in the name of a random pool — the wealth level of the zone: a set of value bin weights. At t0 the bins are equally likely; at t5 the bias is toward the expensive bin. Do not confuse it with the hire tier and the reaction tier.

More details — [Content pool catalog](pools.md).

### Reaction tier

One of the six positions of the “Guard reaction” field (`guardReactionDistribution`); each has its own weight — a non-negative integer. What the tier means has not been established. *Purpose to be confirmed.*

More details — [Zone: all properties](zone.md).

### Road end

The `{ type, args }` selector in the `from` or `to` field of a zone road. There are four kinds of end: a zone object (MainObject), a connection (Connection), a crossroads (Crossroads), and a mandatory content item (MandatoryContent); the argument stores the target’s address — the number of an object, the name of a connection or an item — and the crossroads needs no argument.

More details — [Zone: all properties](zone.md).

### Road surface

“stone · Stone”, “dirt · Dirt”, and “not set” — the three values of the zone road’s `type` field; with “not set”, the key is absent from the file. The format describes the surface as the visual style and the passability; how exactly the surface affects the game — *Purpose to be confirmed.*

More details — [Zone: all properties](zone.md).

### Root settings

The top-level fields and sections of the `.rmg.json` file — outside the `variants[]` list; shared by all layout variants. Edited on three tabs of the right panel: “Template”, “Content”, and “Limits”.

More details — [Template settings (root)](root.md).

### Root’s JSON block

The sixth section of the “Template” tab — “Template JSON (without zones and connections)”. It shows the whole template as a single JSON text; the variants — without `zones` and `connections`. The edits live in the draft and reach the template only through the “Apply” button.

More details — [Template settings (root)](root.md).

### Rule ring

An annular band around the target of a placement rule, drawn by the canvas in the “Content” mode; the `targetMin` and `targetMax` bounds are expressed in fractions of the zone radius. The ring’s color hints at the rule type, and a pale dashed ring means the target is not found or unknown.

More details — [Canvas: view modes](canvas-modes.md).

## S

### Select button

The “+” on a pool row in the content pool catalog: adds the pool’s name to the zone field from which the catalog was opened. For an added pool it turns into “✓”, and a repeated click removes the name; the button does not expand the row. The same “+” on the “Compare” tab selects pools into the comparison table and does not touch the zone field.

More details — [Content pool catalog](pools.md).

### Session backup

The latest state of the work, which the editor automatically writes to the browser storage and silently restores on the next launch: the template, the node positions, the zone notes, the Inspector’s section layout, the active variant, the source file’s name, and the “has unsaved changes” flag. There is a single backup, without a version history. The undo history and the save folder are not part of the backup and are not restored.

More details — [Files: opening and saving](files.md).

### Sidecar file

The service `.editor.json` file that the editor writes next to the template. It stores what does not land in the `.rmg.json`: the canvas node positions, the zone notes, and the Inspector’s section layout.

More details — [Files: opening and saving](files.md).

### Simultaneous-turn squad

The connection’s `simTurnSquad` field in the Inspector’s “Road and simulation” section — not in “Guard”. A list of three positions. *Purpose to be confirmed.* Do not confuse it with the synchronized guard group.

More details — [Connections between zones](connections.md).

### Starting bonus

A record of the `bonuses` list in `gameRules` — what the game gives out at the start of the game: a spell or an artifact to a hero, resources, a change of the hero’s parameters. It consists of the type (`sid`), the receiver side (`receiverSide`), the receiver filter (`receiverFilter`), and the parameters (`parameters`). In the editor — an expanding card in the “Starting bonuses” block.

More details — [Template settings (root)](root.md).

### Status bar

A permanent hint along the bottom edge of the window. The bar reminds you that the node positions are stored in the sidecar file and reports the browser’s current operating mode.

More details — [Interface: windows and panels](interface.md).

### Synchronized guard group

A named group of connections (`guardMatchGroup`): the guards get the same army. The strength, the increment, and the spread match within the group, and the validator watches the match by the filled-in values.

More details — [Connections between zones](connections.md).

## T

### Template

The `.rmg.json` file — the layout of a random map: zones, connections, budgets, rules. One file is exactly one template, and several arrangements of zones and connections inside it are layout variants.

More details — [Editor overview](review.md).

### Template tree

A tab of the left panel: the template structure as a tree — branches of layout variants, and inside each, the “Zones” and “Connections” groups. There is a search by name; the rows carry counters and element labels.

More details — [Interface: windows and panels](interface.md).

### Top bar

The strip along the top edge of the window: the editor name, the template action buttons, info about the open template, the layout variant selector, the “Documentation” button with the built-in manual, and the interface language selection.

More details — [Interface: windows and panels](interface.md).

### Total zone budget

The sum of the zone’s three content budgets: guarded, unguarded, and resource. For each component, the canvas takes the absolute value if it is set and greater than zero, and the per-area value otherwise. The node shows the result as a single compact number — like “12k”.

### Type group

A count limit without a `sid` and without lists from the database — an empty shell that limits nothing. The kind chip in the header shows “group”, and the caption reads “type group”. Do not confuse it with the choice group — that one is a mandatory content item.

More details — [Template settings (root)](root.md).

## U

### “Unsaved changes” window

The confirmation window before the “New”, “Open file”, and “Open folder” buttons, when the current template has unsaved changes. “Continue” discards the edits for good; “Cancel”, Esc, and a click on the backdrop cancel the action. The initial focus is on “Cancel”, so an accidental Enter will not destroy the work.

More details — [Interface: windows and panels](interface.md).

## V

### Validator

The editor’s built-in check of the template: it runs by itself, is recalculated after every change, and the issues are collected on the “Issues” panel. By severity, the issues divide into three groups — errors, warnings, and info.

More details — [Template validation (validator)](validator.md).

### Value

The notional balance currency in which content and guards are measured. Content budgets and guard values are set in its units.

More details — [Connections between zones](connections.md).

### Value bin

One of the five ranges of object value into which four `priceBounds` borders divide the pool. The bin’s weight from the `weights` array — the pool’s preference for objects of this price. In the catalog, each bin is shown as a bar, and the tooltip on hover reads “value ≤3999 → 1”.

More details — [Content pool catalog](pools.md).

### View mode

The way the canvas colors the same diagram: “Overview”, “Budgets”, “Guards”, “Biomes”, “Roads”, “Content”. Switched by the buttons above the canvas and keys 1–6. A mode changes only the coloring and the labels; the template data stays untouched; the Legend and the minimap rebuild for the active mode.

More details — [Canvas: view modes](canvas-modes.md).

## Z

### Zone

A part of the map with its own filling, biome, guard, and object settings. On the canvas, the zone is drawn as a node; the Inspector gathers its properties. In the file — an element of the layout variant’s `zones` array.

More details — [Zone: all properties](zone.md).

### Zone duplication

Creating a copy of a zone by the copy button in the Inspector’s header or by the “Duplicate zone” item of the context menu — of a node on the canvas or of a row in the template tree. The copy gets the first free name of the Zone-1, Zone-2, … series and lands to the right and below the original; it inherits all the settings except the connections and the zone note, is selected, and rolls back with Ctrl+Z.

More details — [Canvas: graph editing](canvas-editing.md).

### Zone layout

A named set of terrain parameters from the template’s root `zoneLayouts` list: obstacle density, lakes, elevations, roads, ambient pickups, and the shares of resource encounters. The zone references the layout by name in the `layout` field.

More details — [Template settings (root)](root.md).

### Zone note

Arbitrary author’s text about the zone: marks about its role in the arrangement, reminders, drafts of ideas. Not written to the `.rmg.json` — stored in the `.editor.json` sidecar file under the zone’s name, one for all layout variants. Only the Inspector of the selected zone shows the note; the game does not see it.

More details — [Zone: all properties](zone.md).

### Zone road

A route inside the zone, a record from the `roads` array: two ends and a surface. The generator lays the zone’s road network along such routes. Not the connection’s `road` flag — that one enables a road along the transition between zones.

More details — [Zone: all properties](zone.md).
