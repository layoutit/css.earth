# Classic NetCDF fixtures

Three small files for the reader tests beside this directory. They were written by the reference library, libnetcdf 4.9.3
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
