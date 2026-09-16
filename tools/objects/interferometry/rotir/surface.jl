# Surface reconstruction of a star on a HEALPix sphere with ROTIR, from key=value arguments.
#
#   julia --project=tools/objects/interferometry/rotir surface.jl oifits=<file> radius_mas=<r> ld1=<u> map=<out> ...
#
# tools/objects/interferometry/surface-reconstruction.mts writes the arguments and documents each one. This script only runs
# the pinned code and writes what it computed: ROTIR's surface map (its own FITS), the star as ROTIR projects it on the sky,
# and a key=value summary. Casting the map onto a lens is not done here: no star has passed the reconstruction checks yet, and
# the longitude convention from ROTIR's surface to a lens needs its own end-to-end check when one does.
#
# ROTIR's coordinates, measured on this commit: colatitude from the rotation pole, longitude right-handed about it. The sky
# frame is x toward celestial West, y toward North, z toward the observer. Inclination 90 with position angle 0 puts the pole
# North in the sky plane; then, at epoch 0, longitude 0 is on the West limb and 270 at the disc centre.
using ROTIR, FITSIO, Statistics, Printf, LinearAlgebra

const args = Dict(split(a, "=", limit=2)[1] => split(a, "=", limit=2)[2] for a in ARGS)
need(key) = haskey(args, key) ? args[key] : error("missing argument $key")
number(key, default=nothing) = haskey(args, key) ? parse(Float64, args[key]) : (default === nothing ? error("missing argument $key") : default)
const T = Float64

data = readoifits_multiepochs([String(need("oifits"))], warn=false, verbose=false, T=T)[1, :]
# Squared visibilities and closure phases only: an Inf error is OITOOLS' own way of leaving an observable out.
for field in (:t3amp_err, :visamp_err, :visphi_err)
    hasproperty(data[1], field) && (getproperty(data[1], field) .= T(Inf))
end

params = (surface_type = 0, radius = number("radius_mas"), tpole = 6000.0, ldtype = Int(number("ld_law", 1)),
          ld1 = number("ld1"), ld2 = number("ld2", 0.0), inclination = number("inclination"),
          position_angle = number("position_angle"), rotation_period = number("rotation_period_days", 1.0))
level = Int(number("level", 4))
tessels = tessellation_healpix(level; T=T)
stars = create_star_multiepochs(tessels, params, [zero(T)])
setup_oi!(data, stars)
x0 = parametric_temperature_map(params, stars[1])
npix = length(x0)
regtype = String(need("regularizer"))
operator = regtype in ("sobel", "sobel2") ? sobel_gradient_healpix(level; T=T) : regtype in ("tv", "tv2") ? tv_neighbors_healpix(level; T=T) : nothing
regularizers = regtype == "none" ? [] : [[regtype, number("weight"), operator, 1:npix]]
start = chi2_breakdown(x0, stars[1], data[1])
x = image_reconstruct_oi(x0, data, stars; maxiter=Int(number("maxiter", 500)), regularizers=regularizers, verbose=false)
final = chi2_breakdown(x, stars[1], data[1])
star = stars[1]

save_surface_map(String(need("map")), x, params; nside_exp=level, tepochs=[zero(T)], field=:temperature,
                 chi2=final.v2 + final.t3phi, ndata=final.nv2 + final.nt3phi, comment="ROTIR $(regtype) $(get(args, "weight", "0")); V2 and T3PHI only")

# The sky as ROTIR sees it: surface brightness times limb darkening, rasterized on its own projection. Columns run East to
# West and rows South to North, so the header states CDELT1 negative like an interferometric reconstruction.
pixel = number("sky_pixel_mas"); pixels = Int(number("sky_pixels"))
sky = rasterize_polygon_image(star.proj_west, star.proj_north, x .* star.ldmap .* star.vis_weights, pixel, pixels)
FITS(String(need("sky")), "w") do io
    # rasterize_polygon_image indexes [north, west]; FITS wants the first axis along columns.
    write(io, permutedims(Float64.(sky), (2, 1)); header=FITSHeader(["CDELT1", "CDELT2", "CUNIT1", "CUNIT2"], [-pixel, pixel, "mas", "mas"], ["east left", "north up", "", ""]))
end

visible = findall(star.normals[:, 3] .> 0)
open(String(need("summary")), "w") do io
    @printf(io, "tiles=%d\nvisible_tiles=%d\nvis2=%d\nt3phi=%d\nstart_chi2r_vis2=%.6f\nstart_chi2r_t3phi=%.6f\nchi2r_vis2=%.6f\nchi2r_t3phi=%.6f\ncontrast=%.6f\n",
            npix, length(visible), final.nv2, final.nt3phi, start.v2r, start.t3phir, final.v2r, final.t3phir, std(x[visible]) / mean(x[visible]))
end
