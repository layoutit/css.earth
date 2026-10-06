# The central depth of each atomic line of a table in a star's atmosphere, by Korg (Wheeler et al. 2023, AJ 165, 68;
# 2024, AJ 167, 83), which toolchain.json pins. mask.mts writes the table and reads the depths; nothing is computed here
# but the calls.
#
#   julia --project=korg korg/depths.jl <lines.tsv> <Teff K> <log g> <[M/H]> <depths.tsv>
#
# lines.tsv: wavelength in air (nm), log gf, species ("26.00"), lower level (eV), and Kurucz's three log damping
# constants (0 where there is none; Korg then uses its own approximations), sorted by wavelength.
#
# The atmosphere is Korg's interpolation of the MARCS grid at the star's parameters, with solar-scaled abundances. Lines
# too weak to matter are set aside by Korg's own pruning (line-centre over continuum absorption at the photosphere under
# PRUNE). Each remaining line is synthesised alone: lines at least SEPARATION apart share a pass, each in its own narrow
# window, so that no line shades another, and its depth is 1 - the lowest flux over the continuum in that window. Hydrogen
# lines are left out, as Korg does when it measures equivalent widths. depths.tsv has one depth for each line of the table,
# in its order; a pruned line has 0.
using Korg

const PRUNE, SEPARATION, HALF_WINDOW, STEP, BUFFER = 0.05, 1.5, 0.04, 0.01, 1.0

function main(args)
    length(args) == 5 || error("usage: depths.jl <lines.tsv> <Teff> <logg> <[M/H]> <depths.tsv>")
    path, teff, logg, m_h, out = args[1], parse(Float64, args[2]), parse(Float64, args[3]), parse(Float64, args[4]), args[5]
    A_X = Korg.format_A_X(m_h)
    atm = Korg.interpolate_marcs(teff, logg, A_X)
    given(x) = x == 0 ? missing : x
    lines = map(eachline(path)) do row
        f = split(row, '\t')
        number(k) = parse(Float64, f[k])
        Korg.Line(Korg.air_to_vacuum(number(1) * 1e-7), number(2), Korg.Species(String(f[3])), number(4),
                  number(5) == 0 ? missing : 10^number(5), number(6) == 0 ? missing : 10^number(6), given(number(7)))
    end
    issorted(lines; by=l -> l.wl) || error("the lines are not sorted by wavelength")
    span = (lines[1].wl * 1e8 - 1, lines[end].wl * 1e8 + 1)
    strong = Set((l.wl, l.species, l.log_gf) for l in Korg.prune_linelist(atm, lines, A_X, span; threshold=PRUNE, sort_by_EW=false, verbose=false))
    kept = [i for (i, l) in enumerate(lines) if (l.wl, l.species, l.log_gf) in strong]
    passes = Vector{Vector{Int}}(); last = Float64[]
    for i in kept
        wl = lines[i].wl * 1e8
        s = findfirst(w -> wl - w >= SEPARATION, last)
        if s === nothing
            push!(passes, [i]); push!(last, wl)
        else
            push!(passes[s], i); last[s] = wl
        end
    end
    depth = zeros(length(lines))
    for pass in passes
        alone = lines[pass]
        windows = [(l.wl * 1e8 - HALF_WINDOW):STEP:(l.wl * 1e8 + HALF_WINDOW) for l in alone]
        sol = Korg.synthesize(atm, alone, A_X, windows; hydrogen_lines=false, line_buffer=BUFFER)
        for (k, sub) in enumerate(sol.subspectra)
            depth[pass[k]] = 1 - minimum(sol.flux[sub] ./ sol.cntm[sub])
        end
    end
    open(out, "w") do io
        for d in depth
            println(io, round(d; digits=4))
        end
    end
    println("{\"lines\": $(length(lines)), \"synthesised\": $(length(kept)), \"passes\": $(length(passes)), \"korg\": \"$(pkgversion(Korg))\"}")
end

main(ARGS)
