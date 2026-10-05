# NetCDF fixtures

Three small classic files and two NetCDF-4 files for the reader tests beside this directory. The classic three first. They were written by the reference library, libnetcdf 4.9.3
(through netCDF4-python 1.7.4), from the definitions below, so the tests compare the TypeScript reader with that library and
not with itself. `ncgen` writes the same content from each definition: `ncgen -k nc6 -o field-cdf2.nc field.cdl`, with
`-k nc3` for the CDF-1 file and `-k cdf5` for the CDF-5 file.

## `field-cdf2.nc` (2,424 bytes, 64-bit offset)

A model history file in miniature: two records and four record variables, which the format interleaves record by record.

```
netcdf field {
dimensions:
	time = UNLIMITED ; // (2 currently)
	lev = 2 ; lat = 4 ; lon = 8 ; latd = 4 ; chars = 4 ;
variables:
	double lat(lat) ;    lat:units = "degrees_north" ;   // -67.5, -22.5, 22.5, 67.5
	double lon(lon) ;    lon:units = "degrees_east" ;    // 0 to 315 by 45
	float latd(latd) ;   latd:units = "degrees_north" ;  // 67.5 down to -67.5
	double lonr(lon) ;   lonr:units = "radians" ;        // the same longitudes in radians
	double lev(lev) ;    lev:units = "hPa" ;             // 100, 1000
	double time(time) ;  time:units = "days since 0001-01-01" ;   // 10.5, 11.5
	int date(time) ;                                               // 20240101, 20240102
	float TS(time, lat, lon) ;      TS:units = "K" ; TS:long_name = "Surface temperature" ;
	float T(time, lev, lat, lon) ;  T:units = "K" ;
	short PACKED(lat, lon) ;        PACKED:_FillValue = -32767s ; PACKED:units = "K" ;
	                                PACKED:scale_factor = 0.5 ; PACKED:add_offset = 200. ;
	double TSD(latd, lon) ;         TSD:units = "K" ;
	char label(chars) ;             // "abcd"
// global attributes:
		:title = "cssEarth classic NetCDF reader fixture" ;
}
```

With `r` the record, `k` the level, `i` the latitude index and `j` the longitude index, all counted from 0:

- `TS[r, i, j] = 200 + 100 r + 10 i + j`
- `T[r, k, i, j] = 1000 k + 100 r + 10 i + j + 0.5`
- `PACKED[i, j]` stores `10 i + j`, and the fill value at `i = 1, j = 2`
- `TSD[i, j] = 300 + 10 i + j`, with `i` counted along `latd`, north to south

## `records-cdf1.nc` (158 bytes, classic)

The format's special case: one record variable alone, whose records are not padded to four bytes.

```
netcdf records {
dimensions:
	time = UNLIMITED ; // (3 currently)
	n = 3 ;
variables:
	byte fixed(n) ;       // -1, 2, 3
	short S(time, n) ;    // record r holds 100 r + 1, 100 r + 2, -(100 r + 3)
}
```

## `types-cdf5.nc` (560 bytes, 64-bit data)

The types only CDF-5 has, with a 64-bit global attribute.

```
netcdf types {
dimensions:
	n = 3 ;
variables:
	ubyte u1(n) ;    // 0, 200, 255
	ushort u2(n) ;   // 0, 40000, 65535
	uint u4(n) ;     // 0, 3000000000, 4294967295
	int64 i8(n) ;    // -9007199254740991, 0, 9007199254740991
	uint64 u8(n) ;   // 0, 1, 9007199254740991
	double f8(n) ;   // -1.5, 0, 2.25
// global attributes:
		:count = 7LL ;
}
```

## `field-nc4.nc` (20,950 bytes, NetCDF-4)

A model file in miniature in the format newer models write, an HDF5 container. Written by the same reference library,
libnetcdf 4.9.3 over HDF5 1.14.6 (through netCDF4-python 1.7.4); `ncgen -k nc4 -o field-nc4.nc field-nc4.cdl` writes the
same content. Its twelve variables are more than a group keeps in its header, so their links are in a heap.

```
netcdf field-nc4 {
dimensions:
	time = 2 ; lev = 3 ; lat = 4 ; lon = 8 ; chars = 4 ;
variables:
	float lat(lat) ;     lat:units = "degrees_north" ;   // -67.5, -22.5, 22.5, 67.5
	float lon(lon) ;     lon:units = "degrees_east" ;    // 22.5 to 337.5 by 45
	double lev(lev) ;    lev:units = "m" ;               // 1000, 2000, 3000
	double time(time) ;  time:units = "hours since 1970-01-01 00:00:00" ;   // 10.5, 11.5
	double T(time, lev, lat, lon) ;  T:units = "K" ; T:standard_name = "air_temperature" ;
	                                 string T:note = "a variable-length string" ;
	double P(time, lev, lat, lon) ;  P:units = "Pa" ;
	float TS(time, lat, lon) ;       TS:units = "K" ;
	short PACKED(lat, lon) ;         PACKED:_FillValue = -32767s ; PACKED:units = "K" ;
	                                 PACKED:scale_factor = 0.5 ; PACKED:add_offset = 200. ;
	float SQUEEZED(lat, lon) ;       SQUEEZED:units = "K" ; SQUEEZED:_ChunkSizes = 2, 4 ; SQUEEZED:_DeflateLevel = 4 ;
	uint COUNTS(lon) ;               // 0, 1, 2, 3, 3000000000, 4294967294, 6, 7
	double UNWRITTEN(lat) ;          UNWRITTEN:units = "K" ;   // declared, never written
	char label(chars) ;              // "abcd"
// global attributes:
		:title = "cssEarth NetCDF-4 reader fixture" ;
}
```

With `r` the time, `k` the level, `i` the latitude index and `j` the longitude index, all counted from 0:

- `T[r, k, i, j] = 1000 - 100 k + 10 i + j + 500 r`
- `P[r, k, i, j] = 1000 * 10^-k * (1 + j / 8)`: pressure falls tenfold from one level to the next, and differs from column
  to column, so one pressure lies between different levels in different columns
- `TS[r, i, j] = 200 + 100 r + 10 i + j`
- `PACKED[i, j]` stores `10 i + j`, and the fill value at `i = 1, j = 2`
- `SQUEEZED[i, j] = 10 i + j`, chunked and compressed: the reader refuses it by name

## `field-nc4-superblock0.nc` (14,320 bytes, NetCDF-4 in HDF5's oldest file layout)

libnetcdf wrote HDF5's first superblock (version 0) until its release 4.6 and writes version 2 since, and a model release
this reader was written for is of the older kind. The current library cannot write it, so this file was written by the HDF5
reference library itself, 1.14.6 through h5py 3.16, in its oldest layout (`libver="earliest"`) with creation order tracked
in the file and every dataset, as libnetcdf tracks it, and with dimension scales attached as libnetcdf attaches them.

- `lat(4)`: -67.5, -22.5, 22.5, 67.5 in `degrees_north`; `lon(8)`: 0 to 315 by 45 in `degrees_east`; `time(2)`: 10.5, 11.5.
  Each is a dimension scale.
- `TS(time, lat, lon)`, double, in `K`: `TS[r, i, j] = 200 + 100 r + 10 i + j`. It carries `units`, `note1` to `note8`
  ("attribute 1" to "attribute 8") and its dimension list: ten attributes, more than a header keeps, so they are in a heap.
- `V1` to `V6`, int: `Vn` holds `n, 10 n, 100 n`. With them the group has ten members, whose links are in a heap too.
