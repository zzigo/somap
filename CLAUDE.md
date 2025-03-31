# SOMAP Project Guidelines

## Build and Run Commands
```bash
# Install dependencies
bun install

# Run development server
bun run index.ts

# Run t1 server (secondary server)
bun run t1.ts

# Serve with hot reload (if available)
bun run reload.js
```

## Code Style Guidelines

### TypeScript
- Use TypeScript for new files with proper type annotations
- Follow `strict: true` mode settings in tsconfig.json
- Use `ESNext` features as configured in tsconfig.json

### Formatting
- Use double quotes for strings
- 2 space indentation
- Use semicolons at the end of statements
- Use camelCase for variables, functions, and methods
- Use PascalCase for classes and types

### Error Handling
- Use try/catch blocks for async operations
- Log errors with details using console.error
- Return appropriate HTTP status codes with clear error messages

### Imports
- Use ES module syntax (`import from`)
- Group imports by external packages first, then internal modules

### API Structure
- Follow RESTful conventions for endpoints
- Use appropriate HTTP methods (GET, POST, PATCH, DELETE)
- Include proper error handling and validation


# structure
## principles
- Structuring a Dynamic Ontology Database
- <mark class="hltr-green"> a graph-based data structure</mark> where concepts remain stable, but their hierarchical relationships shift dynamically based on different perspectives (e.g., historical, material, computational). This aligns closely with knowledge graphs and ontology-based databases, similar to biological taxonomies, protein folding structures, and semantic web technologies.
- generativity, 
- composability
- semantic reasoning capacity 
- app-level validation 
- finite set of Entity Kinds defined by perspective
- The inheritance model is particularly valuable for musical instruments since they naturally form taxonomic hierarchies.

## strategy:  
- Each `Entity` document contains a field `type` (as `_id` or `_key` of a `types` document).  
- Each `type` document contains a `schema`, defining the expected fields and their metadata.  
- When a user selects a `type`, your application uses the associated `schema` to:  
- Render a form  
- Validate user input  
- Populate `props` in the `entity`  

  
# 🔧 SOMAP v2. ARCHITECTURE
  
## A **`perspectives`**  

A **Perspective** becomes a higher-order object: it is not merely a view, but a **world-model**, a local ontology that defines:  
- A **subset or override of kinds**  
- A **valid set of types and relations**  
- A **semantic context** or goal (e.g., speculative design, documentation, live-patching, simulation)  
In formal terms, this aligns with **ontological pluralism** or **contextual logics**:  
- Each `Perspective` defines a **sub-ontology**  
- These can interoperate via **mappings**, **translations**, or **meta-kinds**  
  
Each document defines:  
- `name`: `"lutherie_speculative_patch_v2"`  
- `description`  
- `kinds`: array of kind names available in this perspective  
- `types`: optional list of included or extended types  
- `rules`: optional constraints or inference models  
- `relKinds`: allowed relation predicates  
- `origin`: reference to file, patch, user, etc.  
  
```json  
{  
"_key": "speculative_instrument_session",  
"kinds": ["soundObject", "gesture", "process", "material", "interface"],  
"types": ["membrane", "modulator", "selfAmplifying"],  
"rules": {  
"material must define density": true  
}  
}  
```

7. Meta-model Suggestion  
  
Define super-kinds or meta-kinds like:  
• "ontologyKind": for "object", "agent", etc.  
• "graphKind": e.g., "signal", "interface", "UI"  
• "specKind": for "blueprint", "session", "sketch"

---

##  B **`Kinds`** 
- form the **upper ontology** (defined in perspectives), fixed and small:
- `"object"` (e.g. violin, bow, speaker)
- `"agent"` (e.g. performer, luthier)
- `"material"` (e.g. maple, metal)
- `"environment"` (e.g. stage, forest)
- `"interaction"` → here consider it an **edge or process-type entity**.

They behave like **Categories in Category Theory**. Everything that exists in the graph is an instance of one of these.

---

## C **`Entities`** 

(Single collection)  
Each document contains:  
- as Data-Holding Nodes  
- `kind`: one of `"agent"`, `"object"`, `"material"`, `"environment"` << 6. defined in Perspectives  
- `type`: reference to a `types` document (e.g. `"chordophone"`)  
- `props`: data according to the schema defined in `types`  
- `label`, `description`, etc.  
- Flexibility through schema inheritance
- Rich relationship modeling
- Metadata at multiple levels
  
entities collection should include:  
• type: relation to the types collection (_id or _key)  
• props: Object holding arbitrary data per the type’s schema  
• label: human-readable name  
• optional links like partOf, isSubtypeOf, connectedTo  
  
Example entities document  
```json
{  
"_key": "violin-001",  
"label": "Stradivarius Violin",  
"type": "chordophone",  
"props": {  
"stringCount": 4,  
"tuning": ["G3", "D4", "A4", "E5"],  
"material": "maple + spruce"  
}  
}  
```

---

##  D **`Types`** 
- form the **middle ontology**, extensible:
- `"chordophone"` applies to `"object"`
- `"performer"` applies to `"agent"`
- `"luthier"` applies to `"agent"`
- `"wood"` applies to `"material"`
- `"resonant space"` applies to `"environment"`
- 
### 1. Separate "Type" as a Schema Definition Document  
  
#### **Types** (Single collection)  
Each `type` defines:  
- `name`: e.g. `"chordophone"`, `"luthier"`, `"wood"`  
- `appliesTo`: array of `"kinds"` it can be applied to  
- `schema`: field definitions  
- `extends` (optional): for hierarchy/inheritance  
- `meta`: UI info, ontology tags, etc.  
  
Each document in the `types` collection should define:  
  
- `name`: e.g. `"Chordophone"`  
- `category`: e.g. `"instrument"` or `"meta"`  
- `schema`: an *Object* that defines **field descriptors** and their metadata.  
- `extends`: optional inheritance link to another Type  
  
### Example `types` document  
  
```json  
{  
"_key": "chordophone",  
"name": "Chordophone",  
"category": "instrument",  
"schema": {  
"stringCount": { "type": "number", "required": true },  
"tuning": { "type": "array", "itemType": "string", "optional": true },  
"material": { "type": "string" },  
"bridgeType": { "type": "string", "optional": true }  
}  
}  
```

## E **`Properties`**
- is a collection 
- Reusable property definitions
- works as parameter spaces rathern than just fixed values
- this gives AI agents room to explore variations while staying within physically plausible bounds.
```json
"stringTension": {
  "type": "parameterSpace",
  "min": 10,
  "max": 80,
  "unit": "N",
  "distribution": "gaussian",
  "mean": 45
}
```
```json
{
  "_key": "string_tension",
  "name": "String Tension",
  "dataType": "parameterSpace",
  "min": 10,
  "max": 80,
  "unit": "N",
  "distribution": "gaussian",
  "mean": 45,
  "applicableTo": ["chordophone"],
  "culturalVariation": {
    "western-classical": { "mean": 55, "distribution": "gaussian" },
    "folk-traditions": { "mean": 35, "distribution": "uniform" }
  }
}
```
### Relational Properties with Strength Indicators

- Add weighted relationships to show how strongly properties are connected:
- This helps AI understand causality and correlation between instrument properties.

```json
{
  "_from": "entities/body-size",
  "_to": "entities/pitch-range",
  "predicate": "influences",
  "strength": 0.75,
  "direction": "inverse"
}
```
## F **`Properties Predictors
- is a collection
- Formulas and rules for emergent properties

```json
{
  "_key": "string_resonance",
  "name": "String Resonance Frequency",
  "formula": "sqrt(tension/mass) * length / 2",
  "inputs": ["string_tension", "string_mass", "string_length"],
  "output": {
    "name": "fundamental_frequency",
    "unit": "Hz",
    "dataType": "number"
  },
  "applicableTo": ["chordophone"],
  "confidence": 0.95
}
```
   
## G **`Relations`** (One or more edge collections)  
- Relations as Edges: ontology and semantic links  
- Semantic edges: `"connectedTo"`, `"builtBy"`, `"resonatesIn"`, etc.  
- Ontological edges: `"subTypeOf"`, `"inCategory"`, etc.  
  
Use edge collections like relations, with edge definitions:  
• from: _id of an entity or type  
• to: _id of another entity or type  
• predicate: a string like "connectsTo", "partOf", "influencedBy", etc.  
• metadata: optional justification or source  
  
Example relations edge  
```json
{  
"_from": "entities/violin-001",  
"_to": "entities/bow-002",  
"predicate": "requiresAccessory",  
"metadata": {  
"comment": "Violin requires a bow to be played"  
}  
}  
```
  
4. ArrayFields, some of the can have multiple values :  
  
"connectTo": ["something", "something-else"]  
  
5. Extensible Type System using inheritance  
  ```json
{  
"_key": "violin",  
"name": "Violin",  
"extends": "chordophone",  
"schema": {  
"bowType": { "type": "string" }  
}  
}  
```

---

## 🧠 Reasoning and Generativity

This setup allows an AI agent to:

1. Traverse via relations (edges).
2. Retrieve typed entities.
3. Filter by `kind`, `type`, or schema keys.
4. Generate new combinations: e.g., "generate a chordophone object for outdoor environment using biodegradable materials".

Because the types include structured field descriptors (e.g., `stringCount`, `environmentResistance`), you can define **constraints**, **evaluation rules**, or plug into generative systems.

---

## 🧰 Implementation Notes for ArangoDB

- Use **one `entities` collection**, indexed on `kind` and `type`.
- Use **one `types` collection**, with a `schema` object and `appliesTo` array.
- Use **a small controlled vocabulary for `kind`** (your upper ontology).
- Use **a set of edge collections** or a general `relations` edge with a `predicate` field.

---

## ⛵ Summary of Principles

- Keep `Entity` as a unified concept — it **embodies** something with an identity.
- Use `kind` as your upper ontology anchor: fixed, finite, abstract.
- Let `Type` be compositional, generative, and open — stored in a single collection.
- Encode **semantic relations** as edges, not as hard categories.
- Enable the graph to be traversed by type, kind, relation — not collection name.
- Think of ArangoDB not as a schema enforcer, but as a **flexible semantic container** — structure emerges from your design, not from the DBMS.

---

## References (BibTeX)

```bibtex
@article{guarino2009ontology,
  title={What is an ontology?},
  author={Guarino, Nicola and Oberle, Daniel and Staab, Steffen},
  booktitle={Handbook on ontologies},
  pages={1--17},
  year={2009},
  publisher={Springer}

}

@article{angles2012graph,
  title={Graph databases: models and applications},
  author={Angles, Renzo},
  journal={Information Systems},
  volume={36},
  number={4},
  year={2012},
  pages={270--288}
}

@book{fowler2012nosql,
  title={NoSQL distilled: A brief guide to the emerging world of polyglot persistence},
  author={Fowler, Martin and Sadalage, Pramod J},
  year={2012},
  publisher={Addison-Wesley}
  }
  
@inproceedings{gomez2004ontological,
  title={Ontological Engineering: With Examples from the Areas of Knowledge Management, E-Commerce and the Semantic Web},
  author={Gómez-Pérez, Asunción and Fernández-López, Mariano and Corcho, Oscar},
  booktitle={Advanced Information and Knowledge Processing},
  year={2004},
  publisher={Springer}
}

@article{smith2004ontology,
  title={Ontology and information systems},
  author={Smith, Barry},
  journal={The Semantic Web},
  volume={3},
  number={2},
  year={2004},
  pages={5--10}
}

@article{czachor2022perspectival,
  title={Perspectival modeling of scientific objects: between representation and performance},
  author={Czachor, Kamil},
  journal={Philosophy of Science},
  volume={89},
  number={5},
  year={2022},
  pages={1143–1155}
}
```
