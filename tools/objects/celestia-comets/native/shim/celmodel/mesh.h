// SPDX-License-Identifier: GPL-2.0-or-later
// Storage-only adapter for the exact upstream SphereMesh::convertToMesh call.
// No geometry, normals, noise, triangulation or normalization is generated here.
#pragma once
#include <Eigen/Geometry>
#include <cstdint>
#include <vector>
#include <utility>
namespace cmod {
using VWord=std::uint32_t;
using Index32=std::uint32_t;
enum class VertexAttributeSemantic { Position, Normal, Texture0 };
enum class VertexAttributeFormat { Float3, Float2 };
enum class PrimitiveGroupType { TriStrip };
struct VertexAttribute {VertexAttribute(VertexAttributeSemantic,VertexAttributeFormat,int){}};
struct VertexDescription {explicit VertexDescription(std::vector<VertexAttribute>){}};
struct Mesh {
 int count=0;std::vector<VWord> data;std::vector<std::vector<Index32>> groups;
 void setVertexDescription(VertexDescription){}
 void setVertices(int n,std::vector<VWord> d){count=n;data=std::move(d);}
 void addGroup(PrimitiveGroupType,unsigned,std::vector<Index32> indices){groups.push_back(std::move(indices));}
};
}
