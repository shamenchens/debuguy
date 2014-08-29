/*
 *
 * https://github.com/seiyugi/debuguy
 *
 * Copyright (c) 2014 seiyugi
 * Licensed under the MPL license.
 */

'use strict';

var BundleGraph = function(option) {
  this.init(option);
};

BundleGraph.prototype.init = function(option) {
  var diameter = option.diameter;
  var radius = diameter / 2;
  var innerRadius = radius - 200;
  this.nodes = [];
  this.links = [];
  this.sequence = [];
  this.sourceNode = null;

  this.cluster = d3.layout.cluster()
    .size([innerRadius, innerRadius])
    .sort(null)
    .value(function(d) { return d.size; });

  this.bundle = d3.layout.bundle();

  this.svg = d3.select('body').append('svg')
    .attr('width', diameter)
    .attr('height', diameter)
    .append('g')
    .attr('transform', 'translate(' + radius + ',' + radius + ')');

  this.line = d3.svg.line.radial()
    .interpolate('bundle')
    .tension(.85)
    .radius(function(d) { return d.y; })
    .angle(function(d) { return d.x / 180 * Math.PI; });

  this.link = this.svg.append('g').selectAll('.link');
  this.node = this.svg.append('g').selectAll('.node');
};

// Construct tag hierarchy from node path
BundleGraph.prototype.tagHierarchy = function(node) {
  var map = {};
  function find(name, data) {
    console.log('find: ', name, 'data: ', data);
    var i;
    var node = map[name];
    if (!node) {
      node = map[name] = data || {name: name, children: []};
      if (name.length) {
        node.parent = find(name.substring(0, i = name.lastIndexOf('.')));
        node.parent.children.push(node);
        node.key = name.substring(i + 1);
      }
    }
    return node;
  }

  node.forEach(function(d) {
    find(d.name, d);
  });
  return map[''];
};

// Return a list of imports for the given array of nodes.
BundleGraph.prototype.packageImports = function(nodes) {
  var map = {};
  var imports = [];

  // Compute a map from name to node.
  nodes.forEach(function(d) {
    map[d.name] = d;
  });

  // For each import, construct a link from the source to target node.
  nodes.forEach(function(d) {
    if (d.imports) d.imports.forEach(function(i) {
      imports.push({source: map[d.name], target: map[i]});
    });
  });

  return imports;
};

BundleGraph.prototype.updateGraph = function() {
  var self = this;

  d3.json('readme-flare-imports.json', function(error, classes) {
    var nodes = this.cluster.nodes(this.tagHierarchy(classes));
    var links = this.packageImports(nodes);

    console.log(this.bundle(links));
    this.link = this.link.data(this.bundle(links))
      .enter().append('path')
      .each(function(d) { d.source = d[0]; d.target = d[d.length - 1]; })
      .attr('class', 'link')
      .attr('d', this.line);

    this.node = this.node.data(nodes.filter(function(n) { return !n.children; }))
      .enter().append('text')
      .attr('class', 'node')
      .attr('dy', '.31em')
      .attr('transform', function(d) { return 'rotate(' + (d.x - 90) + ')translate(' + (d.y + 8) + ',0)' + (d.x < 180 ? '' : 'rotate(180)'); })
      .style('text-anchor', function(d) { return d.x < 180 ? 'start' : 'end'; })
      .text(function(d) { return d.key; })
      .on('mouseover', mouseovered)
      .on('mouseout', mouseouted);
  }.bind(this));

  function mouseovered(d) {
    self.node.each(function(n) { n.target = n.source = false; });

    self.link.classed('linkTarget', function(l) {
        if (l.target === d) return l.source.source = true;
      })
      .classed('linkSource', function(l) {
        if (l.source === d) return l.target.target = true;
      })
      .filter(function(l) { return l.target === d || l.source === d; })
      .each(function() { this.parentNode.appendChild(this); });

    self.node.classed('nodeTarget', function(n) { return n.target; })
      .classed('nodeSource', function(n) { return n.source; });
  }

  function mouseouted(d) {
    self.link.classed('linkTarget', false)
      .classed('linkSource', false);

    self.node.classed('nodeTarget', false)
      .classed('nodeSource', false);
  }

};

BundleGraph.prototype.findNode = function(path) {
  var nodes = this.nodes;
  for (var i in nodes) {
    if (nodes[i].id === path) return i;
  }
};

BundleGraph.prototype.addNode = function(path) {
  var node;
  var nodeIndex = this.findNode(path);
  if (nodeIndex) {
    node = this.nodes[nodeIndex];
  } else {
    node = {id: path};
    this.nodes.push(node);
  }
  return node;
};

BundleGraph.prototype.addSequence = function(node) {
  var path = node.path.join('-');
  var node = this.addNode(path);
  if (this.sourceNode) {
    var link = {
      source: this.sourceNode,
      target: node
    }
    this.links.push(link);
  }
  this.sourceNode = node;
};
