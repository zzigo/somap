import networkx as nx
from matplotlib.colors import to_hex, to_rgb

# Function to lighten a color for gradient effect
def lighten_color(color, factor=0.2):
    rgb = to_rgb(color)
    lighter_rgb = [min(1, c + factor) for c in rgb]  # Lighten each RGB channel
    return to_hex(lighter_rgb)

# Define the base node attributes
nodes = [
    {"id": "3", "label": "materials", "color": "#ff7043", "size": 5, "level": 1},
    {"id": "5", "label": "subjects", "color": "#42a5f5", "size": 5, "level": 1},
    {"id": "4", "label": "objects", "color": "#66bb6a", "size": 5, "level": 1},
    {"id": "6", "label": "interactions", "color": "#ab47bc", "size": 5, "level": 1},
]

# Define subnodes with relationships
subnodes = [
    {"id": "500", "label": "humans", "parent": "5"},
    {"id": "501", "label": "non-humans", "parent": "5"},
    {"id": "502", "label": "cyborgs", "parent": "5"},
    {"id": "503", "label": "avatars", "parent": "5"},
    {"id": "400", "label": "primitives", "parent": "4"},
    {"id": "401", "label": "tools", "parent": "4"},
    {"id": "402", "label": "soundbased", "parent": "4"},
    {"id": "600", "label": "microscale", "parent": "6"},
    {"id": "601", "label": "vocality", "parent": "6"},
    {"id": "602", "label": "env-sens", "parent": "6"},
    {"id": "603", "label": "bio-sens", "parent": "6"},
    {"id": "604", "label": "vocality", "parent": "6"},
    {"id": "605", "label": "dmi", "parent": "6"},
    {"id": "606", "label": "acoustic", "parent": "6"},
]

# Create the graph
G = nx.DiGraph()

# Add parent nodes
for node in nodes:
    G.add_node(
        node["id"],
        label=node["label"],
        color=node["color"],
        size=node["size"],
        level=node["level"],
    )

# Add subnodes and compute their colors
for subnode in subnodes:
    parent_color = G.nodes[subnode["parent"]]["color"]
    subnode_color = lighten_color(parent_color, factor=0.3)
    G.add_node(
        subnode["id"],
        label=subnode["label"],
        color=subnode_color,
        size=3,
        level=G.nodes[subnode["parent"]]["level"] + 1,
    )
    G.add_edge(subnode["parent"], subnode["id"])

# Add edges between main nodes
edges = [
    {"id": "4", "source": "4", "target": "5"},
    {"id": "3", "source": "3", "target": "4"},
    {"id": "5", "source": "5", "target": "6"},
]
for edge in edges:
    G.add_edge(edge["source"], edge["target"], id=edge["id"])

# Write the graph to a GEXF file
output_path = "sonet2.gexf"
nx.write_gexf(G, output_path)

output_path