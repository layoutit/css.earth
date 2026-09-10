// SPDX-License-Identifier: GPL-2.0-or-later
// Headless driver of Celestia's original SphereMesh and Perlin implementation.
// Arguments come directly from a pinned .cms file. Native float bytes and strip
// indices are retained before any cssEarth welding, axis conversion or reduction.
#include <iostream>
#include <iomanip>
#include <cstring>
#include <cstdlib>
#include <celengine/spheremesh.h>
#include <celmodel/mesh.h>
#include <celmath/randutils.h>
int main(int argc,char**argv){
 if(argc!=12)return 2;
 SphereMeshParameters p{};
 p.size={std::stof(argv[1]),std::stof(argv[2]),std::stof(argv[3])};
 p.offset={std::stof(argv[4]),std::stof(argv[5]),std::stof(argv[6])};
 p.featureHeight=std::stof(argv[7]);p.octaves=std::stof(argv[8]);p.rings=std::stof(argv[9]);p.slices=std::stof(argv[10]);
 celestia::math::getRNG().seed(std::stoul(argv[11]));
 SphereMesh source(p.size,int(p.rings),int(p.slices),p);auto mesh=source.convertToMesh();
 std::cout<<std::setprecision(9)<<"{\"vertices\":[";
 for(int i=0;i<mesh.count;i++){float xyz[3];std::memcpy(xyz,&mesh.data[i*8],12);if(i)std::cout<<',';std::cout<<'['<<xyz[0]<<','<<xyz[1]<<','<<xyz[2]<<']';}
 std::cout<<"],\"strips\":[";bool first=true;
 for(const auto&strip:mesh.groups){if(!first)std::cout<<',';first=false;std::cout<<'[';for(size_t i=0;i<strip.size();i++){if(i)std::cout<<',';std::cout<<strip[i];}std::cout<<']';}
 std::cout<<"]}\n";
}
