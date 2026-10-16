# Sankey reference examples

These are structural classifications of the ten supplied images. Similar layouts are not separate statistical methods.

| Image | Closest preset | Data needed |
| --- | --- | --- |
| 1: clusters → system → food → security → intervention | Multi-stage Sankey | Weighted adjacent-stage links, or complete paths |
| 2: energy sources and uses | Multi-stage Sankey | Positive weighted flows, including any stage-skipping links |
| 3: Sample A/B/C categories | Alluvial / parallel sets | Complete category paths and their weights; pairwise totals alone are insufficient |
| 4: farms and recycling loop | Circular Sankey | Weighted links including explicit backward feedback |
| 5: categories → preferences | Two-stage Sankey | Source/target/value rows |
| 6: dense branching categories | Multi-stage Sankey | Weighted links; density changes readability, not the diagram family |
| 7: scales and conditional subdivisions | Hierarchical Sankey | A single parent for each branch node; repeated categories may need branch-specific IDs |
| 8: monthly budget | Multi-stage Sankey | Weighted links; its initial income merge means the whole figure is not a strict tree |
| 9: methods → data collection | Two-stage Sankey | Source/target/value rows |
| 10: website flows | Multi-stage Sankey | Weighted links, including skip-stage routes; full session paths if tracking cohorts |

eQc offers five presets and explicitly labelled fictional examples in their settings. Project coding uses classification counts, not inferred journeys. Unequal incoming/outgoing totals are reported without invented balancing flows.

Standard terminology and input principles: [D3 Sankey](https://github.com/d3/d3-sankey), [ggalluvial introduction](https://corybrunson.github.io/ggalluvial/articles/ggalluvial.html), [Plotly Sankey documentation](https://plotly.com/python/sankey-diagram/), and [circular Sankey extension](https://github.com/tomshanley/d3-sankey-circular).
