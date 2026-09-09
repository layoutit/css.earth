Citation:
Naoyuki Hirata, Eri Tatsumi, Mayumi Ichikawa, Kazuhiro Honda, Sayuri Tanaka (2026) 
Bundle adjustment of Hayabusa2's ONC images and controlled color mosaic map of Ryugu. 
arXiv preprint arXiv:2602.12554

Contact: 
Naoyuki Hirata (Kobe Univ.) 
Email: hirata@tiger.kobe-u.ac.jp

Feb. 10 2026 

######################################################
####     Index                                    ####

1．Download URL
2．Files and Directories     
3．Mosaic Map (./mosaic/***/ryugu_***.tif)
4．Geotiff Map File (./map/***/hyb2_onc_***.tif) 
5．Tutorials  (Gdal command)
6．Tutorials  (Gdal Python package)

######################################################
####         1．Download URL                      ####

# All mosaics and maps can be downloaded using the following wget command.

# Camera geometry and Summary Files Download URL 
wget https://dataverse.harvard.edu/api/access/datafile/13463835 -O ReadMeFirst.pptx
wget https://dataverse.harvard.edu/api/access/datafile/13439130 -O onc_camerainfo.txt
wget https://dataverse.harvard.edu/api/access/datafile/13439122 -O SUMFILES.zip
wget https://dataverse.harvard.edu/api/access/datafile/13463836 -O info.zip

# Mosaics Download URL
wget https://dataverse.harvard.edu/api/access/datafile/13452500 -O GLOBAL.zip
wget https://dataverse.harvard.edu/api/access/datafile/13439929 -O MASCOT.zip
wget https://dataverse.harvard.edu/api/access/datafile/13439927 -O MINERVA.zip
wget https://dataverse.harvard.edu/api/access/datafile/13444134 -O REGIONAL-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13444136 -O REGIONAL-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13439923 -O TD1-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13439926 -O TD1-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13439932 -O TD2-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13439924 -O TD2-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13439930 -O TD2-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13439928 -O TD2-4.zip

# Maps Download URL
# NorthPolarMap l2b 
wget https://dataverse.harvard.edu/api/access/datafile/13447273 -O north_l2b_img_201809.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447268 -O north_l2b_img_201901-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447285 -O north_l2b_img_201901-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447263 -O north_l2b_img_201901-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447253 -O north_l2b_img_201902.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447286 -O north_l2b_img_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447272 -O north_l2b_img_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447250 -O north_l2b_img_201910.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447255 -O north_l2b_emi_201809.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447257 -O north_l2b_emi_201901-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447264 -O north_l2b_emi_201901-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447262 -O north_l2b_emi_201901-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447283 -O north_l2b_emi_201902.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447270 -O north_l2b_emi_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447276 -O north_l2b_emi_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447249 -O north_l2b_emi_201910.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447247 -O north_l2b_inc_201809.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447254 -O north_l2b_inc_201901-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447279 -O north_l2b_inc_201901-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447271 -O north_l2b_inc_201901-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447282 -O north_l2b_inc_201902.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447260 -O north_l2b_inc_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447267 -O north_l2b_inc_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447269 -O north_l2b_inc_201910.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447278 -O north_l2b_pha_201809.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447266 -O north_l2b_pha_201901-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447284 -O north_l2b_pha_201901-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447252 -O north_l2b_pha_201901-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447248 -O north_l2b_pha_201902.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447258 -O north_l2b_pha_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447259 -O north_l2b_pha_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447275 -O north_l2b_pha_201910.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447274 -O north_l2b_res_201809.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447281 -O north_l2b_res_201901-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447251 -O north_l2b_res_201901-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447265 -O north_l2b_res_201901-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447256 -O north_l2b_res_201902.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447277 -O north_l2b_res_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447261 -O north_l2b_res_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447280 -O north_l2b_res_201910.zip

# NorthPolarMap l2d
wget https://dataverse.harvard.edu/api/access/datafile/13447240 -O north_l2d_emi_201809.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447229 -O north_l2d_emi_201901-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447209 -O north_l2d_emi_201901-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447233 -O north_l2d_emi_201901-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447214 -O north_l2d_emi_201902.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447221 -O north_l2d_emi_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447236 -O north_l2d_emi_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447215 -O north_l2d_emi_201910.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447203 -O north_l2d_inc_201809.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447207 -O north_l2d_inc_201901-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447222 -O north_l2d_inc_201901-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447231 -O north_l2d_inc_201901-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447210 -O north_l2d_inc_201902.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447218 -O north_l2d_inc_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447224 -O north_l2d_inc_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447223 -O north_l2d_inc_201910.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447239 -O north_l2d_pha_201809.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447204 -O north_l2d_pha_201901-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447220 -O north_l2d_pha_201901-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447211 -O north_l2d_pha_201901-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447208 -O north_l2d_pha_201902.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447238 -O north_l2d_pha_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447213 -O north_l2d_pha_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447206 -O north_l2d_pha_201910.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447232 -O north_l2d_res_201809.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447216 -O north_l2d_res_201901-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447237 -O north_l2d_res_201901-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447205 -O north_l2d_res_201901-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447217 -O north_l2d_res_201902.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447219 -O north_l2d_res_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447235 -O north_l2d_res_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447234 -O north_l2d_res_201910.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447225 -O north_l2d_img_201809.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447212 -O north_l2d_img_201901-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447230 -O north_l2d_img_201901-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447241 -O north_l2d_img_201901-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447228 -O north_l2d_img_201902.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447202 -O north_l2d_img_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447226 -O north_l2d_img_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447227 -O north_l2d_img_201910.zip

# SouthPolarMap l2b
wget https://dataverse.harvard.edu/api/access/datafile/13447158 -O south_l2b_img_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447144 -O south_l2b_img_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447165 -O south_l2b_img_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447171 -O south_l2b_img_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447147 -O south_l2b_emi_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447166 -O south_l2b_emi_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447167 -O south_l2b_emi_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447155 -O south_l2b_emi_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447148 -O south_l2b_inc_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447157 -O south_l2b_inc_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447170 -O south_l2b_inc_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447140 -O south_l2b_inc_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447176 -O south_l2b_pha_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447149 -O south_l2b_pha_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447173 -O south_l2b_pha_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447151 -O south_l2b_pha_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447142 -O south_l2b_res_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447177 -O south_l2b_res_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447146 -O south_l2b_res_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447141 -O south_l2b_res_201907.zip

# SouthPolarMap l2d
wget https://dataverse.harvard.edu/api/access/datafile/13447161 -O south_l2d_img_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447145 -O south_l2d_img_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447156 -O south_l2d_img_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447139 -O south_l2d_img_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447152 -O south_l2d_emi_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447178 -O south_l2d_emi_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447174 -O south_l2d_emi_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447159 -O south_l2d_emi_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447175 -O south_l2d_inc_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447172 -O south_l2d_inc_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447143 -O south_l2d_inc_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447169 -O south_l2d_inc_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447154 -O south_l2d_pha_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447150 -O south_l2d_pha_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447168 -O south_l2d_pha_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447162 -O south_l2d_pha_201907.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447153 -O south_l2d_res_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447163 -O south_l2d_res_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447164 -O south_l2d_res_201903.zip
wget https://dataverse.harvard.edu/api/access/datafile/13447160 -O south_l2d_res_201907.zip

# SimpleCylindricalMap l2b
wget https://dataverse.harvard.edu/api/access/datafile/13448105 -O simple_l2b_img_201806.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448120 -O simple_l2b_img_201807-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448111 -O simple_l2b_img_201807-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448126 -O simple_l2b_img_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448107 -O simple_l2b_img_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448103 -O simple_l2b_img_201809-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448125 -O simple_l2b_img_201809-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448109 -O simple_l2b_img_201810-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448112 -O simple_l2b_img_201810-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448102 -O simple_l2b_img_201810-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448104 -O simple_l2b_img_201810-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448127 -O simple_l2b_img_201810-5.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448129 -O simple_l2b_img_201810-6.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448133 -O simple_l2b_img_201811.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448108 -O simple_l2b_img_201901.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448132 -O simple_l2b_img_201902-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448115 -O simple_l2b_img_201902-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448134 -O simple_l2b_img_201903-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448121 -O simple_l2b_img_201903-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448110 -O simple_l2b_img_201904.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448114 -O simple_l2b_img_201905-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448131 -O simple_l2b_img_201905-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448113 -O simple_l2b_img_201905-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448117 -O simple_l2b_img_201906-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448116 -O simple_l2b_img_201906-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448135 -O simple_l2b_img_201907-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448122 -O simple_l2b_img_201907-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448118 -O simple_l2b_img_201907-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448130 -O simple_l2b_img_201907-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448124 -O simple_l2b_img_201908.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448119 -O simple_l2b_img_201909.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448136 -O simple_l2b_img_201910-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448106 -O simple_l2b_img_201910-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448123 -O simple_l2b_img_201910-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448128 -O simple_l2b_img_201911.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456317 -O simple_l2b_emi_201806.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456331 -O simple_l2b_emi_201807-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456328 -O simple_l2b_emi_201807-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456320 -O simple_l2b_emi_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456333 -O simple_l2b_emi_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456309 -O simple_l2b_emi_201809-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456321 -O simple_l2b_emi_201809-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456327 -O simple_l2b_emi_201810-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456315 -O simple_l2b_emi_201810-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456303 -O simple_l2b_emi_201810-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456334 -O simple_l2b_emi_201810-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456306 -O simple_l2b_emi_201810-5.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456304 -O simple_l2b_emi_201810-6.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456325 -O simple_l2b_emi_201811.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456314 -O simple_l2b_emi_201901.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456300 -O simple_l2b_emi_201902-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456319 -O simple_l2b_emi_201902-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456307 -O simple_l2b_emi_201903-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456302 -O simple_l2b_emi_201903-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456313 -O simple_l2b_emi_201904.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456318 -O simple_l2b_emi_201905-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456330 -O simple_l2b_emi_201905-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456301 -O simple_l2b_emi_201905-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456310 -O simple_l2b_emi_201906-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456326 -O simple_l2b_emi_201906-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456323 -O simple_l2b_emi_201907-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456329 -O simple_l2b_emi_201907-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456324 -O simple_l2b_emi_201907-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456311 -O simple_l2b_emi_201907-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456316 -O simple_l2b_emi_201908.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456332 -O simple_l2b_emi_201909.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456322 -O simple_l2b_emi_201910-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456312 -O simple_l2b_emi_201910-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456308 -O simple_l2b_emi_201910-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456305 -O simple_l2b_emi_201911.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456343 -O simple_l2b_inc_201806.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456345 -O simple_l2b_inc_201807-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456353 -O simple_l2b_inc_201807-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456361 -O simple_l2b_inc_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456360 -O simple_l2b_inc_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456368 -O simple_l2b_inc_201809-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456362 -O simple_l2b_inc_201809-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456359 -O simple_l2b_inc_201810-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456338 -O simple_l2b_inc_201810-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456340 -O simple_l2b_inc_201810-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456349 -O simple_l2b_inc_201810-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456369 -O simple_l2b_inc_201810-5.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456354 -O simple_l2b_inc_201810-6.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456342 -O simple_l2b_inc_201811.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456348 -O simple_l2b_inc_201901.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456366 -O simple_l2b_inc_201902-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456344 -O simple_l2b_inc_201902-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456347 -O simple_l2b_inc_201903-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456339 -O simple_l2b_inc_201903-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456346 -O simple_l2b_inc_201904.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456352 -O simple_l2b_inc_201905-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456372 -O simple_l2b_inc_201905-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456358 -O simple_l2b_inc_201905-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456370 -O simple_l2b_inc_201906-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456357 -O simple_l2b_inc_201906-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456365 -O simple_l2b_inc_201907-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456356 -O simple_l2b_inc_201907-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456364 -O simple_l2b_inc_201907-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456350 -O simple_l2b_inc_201907-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456351 -O simple_l2b_inc_201908.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456355 -O simple_l2b_inc_201909.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456363 -O simple_l2b_inc_201910-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456367 -O simple_l2b_inc_201910-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456371 -O simple_l2b_inc_201910-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456341 -O simple_l2b_inc_201911.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456523 -O simple_l2b_pha_201806.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456522 -O simple_l2b_pha_201807-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456545 -O simple_l2b_pha_201807-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456528 -O simple_l2b_pha_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456549 -O simple_l2b_pha_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456534 -O simple_l2b_pha_201809-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456527 -O simple_l2b_pha_201809-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456551 -O simple_l2b_pha_201810-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456535 -O simple_l2b_pha_201810-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456546 -O simple_l2b_pha_201810-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456521 -O simple_l2b_pha_201810-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456519 -O simple_l2b_pha_201810-5.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456536 -O simple_l2b_pha_201810-6.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456531 -O simple_l2b_pha_201811.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456520 -O simple_l2b_pha_201901.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456525 -O simple_l2b_pha_201902-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456541 -O simple_l2b_pha_201902-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456537 -O simple_l2b_pha_201903-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456530 -O simple_l2b_pha_201903-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456524 -O simple_l2b_pha_201904.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456532 -O simple_l2b_pha_201905-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456540 -O simple_l2b_pha_201905-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456548 -O simple_l2b_pha_201905-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456550 -O simple_l2b_pha_201906-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456547 -O simple_l2b_pha_201906-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456526 -O simple_l2b_pha_201907-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456543 -O simple_l2b_pha_201907-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456542 -O simple_l2b_pha_201907-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456553 -O simple_l2b_pha_201907-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456539 -O simple_l2b_pha_201908.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456544 -O simple_l2b_pha_201909.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456529 -O simple_l2b_pha_201910-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456533 -O simple_l2b_pha_201910-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456552 -O simple_l2b_pha_201910-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456538 -O simple_l2b_pha_201911.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456251 -O simple_l2b_res_201806.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456256 -O simple_l2b_res_201807-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456265 -O simple_l2b_res_201807-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456275 -O simple_l2b_res_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456269 -O simple_l2b_res_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456252 -O simple_l2b_res_201809-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456272 -O simple_l2b_res_201809-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456285 -O simple_l2b_res_201810-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456259 -O simple_l2b_res_201810-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456278 -O simple_l2b_res_201810-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456279 -O simple_l2b_res_201810-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456263 -O simple_l2b_res_201810-5.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456267 -O simple_l2b_res_201810-6.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456281 -O simple_l2b_res_201811.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456254 -O simple_l2b_res_201901.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456260 -O simple_l2b_res_201902-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456283 -O simple_l2b_res_201902-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456282 -O simple_l2b_res_201903-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456273 -O simple_l2b_res_201903-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456274 -O simple_l2b_res_201904.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456253 -O simple_l2b_res_201905-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456280 -O simple_l2b_res_201905-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456284 -O simple_l2b_res_201905-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456261 -O simple_l2b_res_201906-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456262 -O simple_l2b_res_201906-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456271 -O simple_l2b_res_201907-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456277 -O simple_l2b_res_201907-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456276 -O simple_l2b_res_201907-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456268 -O simple_l2b_res_201907-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456266 -O simple_l2b_res_201908.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456257 -O simple_l2b_res_201909.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456264 -O simple_l2b_res_201910-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456255 -O simple_l2b_res_201910-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456258 -O simple_l2b_res_201910-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456270 -O simple_l2b_res_201911.zip

# SimpleCylindricalMap l2d
wget https://dataverse.harvard.edu/api/access/datafile/13448068 -O simple_l2d_img_201806.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448067 -O simple_l2d_img_201807-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448059 -O simple_l2d_img_201807-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448035 -O simple_l2d_img_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448060 -O simple_l2d_img_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448046 -O simple_l2d_img_201809-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448045 -O simple_l2d_img_201809-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448053 -O simple_l2d_img_201810-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448051 -O simple_l2d_img_201810-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448036 -O simple_l2d_img_201810-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448048 -O simple_l2d_img_201810-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448042 -O simple_l2d_img_201810-5.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448054 -O simple_l2d_img_201810-6.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448061 -O simple_l2d_img_201811.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448039 -O simple_l2d_img_201901.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448047 -O simple_l2d_img_201902-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448037 -O simple_l2d_img_201902-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448052 -O simple_l2d_img_201903-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448050 -O simple_l2d_img_201903-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448049 -O simple_l2d_img_201904.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448062 -O simple_l2d_img_201905-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448044 -O simple_l2d_img_201905-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448064 -O simple_l2d_img_201905-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448057 -O simple_l2d_img_201906-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448034 -O simple_l2d_img_201906-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448066 -O simple_l2d_img_201907-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448058 -O simple_l2d_img_201907-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448056 -O simple_l2d_img_201907-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448040 -O simple_l2d_img_201907-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448063 -O simple_l2d_img_201908.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448055 -O simple_l2d_img_201909.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448038 -O simple_l2d_img_201910-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448041 -O simple_l2d_img_201910-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448065 -O simple_l2d_img_201910-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448043 -O simple_l2d_img_201911.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448271 -O simple_l2d_emi_201806.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448255 -O simple_l2d_emi_201807-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448262 -O simple_l2d_emi_201807-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448257 -O simple_l2d_emi_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448248 -O simple_l2d_emi_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448249 -O simple_l2d_emi_201809-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448278 -O simple_l2d_emi_201809-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448259 -O simple_l2d_emi_201810-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448263 -O simple_l2d_emi_201810-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448251 -O simple_l2d_emi_201810-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448266 -O simple_l2d_emi_201810-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448273 -O simple_l2d_emi_201810-5.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448258 -O simple_l2d_emi_201810-6.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448254 -O simple_l2d_emi_201811.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448268 -O simple_l2d_emi_201901.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448250 -O simple_l2d_emi_201902-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448269 -O simple_l2d_emi_201902-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448261 -O simple_l2d_emi_201903-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448252 -O simple_l2d_emi_201903-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448244 -O simple_l2d_emi_201904.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448272 -O simple_l2d_emi_201905-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448246 -O simple_l2d_emi_201905-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448264 -O simple_l2d_emi_201905-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448267 -O simple_l2d_emi_201906-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448247 -O simple_l2d_emi_201906-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448277 -O simple_l2d_emi_201907-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448256 -O simple_l2d_emi_201907-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448245 -O simple_l2d_emi_201907-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448265 -O simple_l2d_emi_201907-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448270 -O simple_l2d_emi_201908.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448274 -O simple_l2d_emi_201909.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448275 -O simple_l2d_emi_201910-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448253 -O simple_l2d_emi_201910-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448276 -O simple_l2d_emi_201910-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448260 -O simple_l2d_emi_201911.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448562 -O simple_l2d_inc_201806.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448559 -O simple_l2d_inc_201807-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448571 -O simple_l2d_inc_201807-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448573 -O simple_l2d_inc_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448585 -O simple_l2d_inc_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448557 -O simple_l2d_inc_201809-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448590 -O simple_l2d_inc_201809-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448579 -O simple_l2d_inc_201810-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448564 -O simple_l2d_inc_201810-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448588 -O simple_l2d_inc_201810-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448561 -O simple_l2d_inc_201810-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448563 -O simple_l2d_inc_201810-5.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448560 -O simple_l2d_inc_201810-6.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448558 -O simple_l2d_inc_201811.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448568 -O simple_l2d_inc_201901.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448576 -O simple_l2d_inc_201902-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448567 -O simple_l2d_inc_201902-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448582 -O simple_l2d_inc_201903-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448587 -O simple_l2d_inc_201903-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448589 -O simple_l2d_inc_201904.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448569 -O simple_l2d_inc_201905-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448586 -O simple_l2d_inc_201905-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448584 -O simple_l2d_inc_201905-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448575 -O simple_l2d_inc_201906-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448570 -O simple_l2d_inc_201906-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448556 -O simple_l2d_inc_201907-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448574 -O simple_l2d_inc_201907-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448583 -O simple_l2d_inc_201907-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448580 -O simple_l2d_inc_201907-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448565 -O simple_l2d_inc_201908.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448577 -O simple_l2d_inc_201909.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448578 -O simple_l2d_inc_201910-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448572 -O simple_l2d_inc_201910-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448566 -O simple_l2d_inc_201910-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448581 -O simple_l2d_inc_201911.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456517 -O simple_l2d_pha_201806.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456514 -O simple_l2d_pha_201807-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456518 -O simple_l2d_pha_201807-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456511 -O simple_l2d_pha_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456504 -O simple_l2d_pha_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456512 -O simple_l2d_pha_201809-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456515 -O simple_l2d_pha_201809-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456516 -O simple_l2d_pha_201810-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456508 -O simple_l2d_pha_201810-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456509 -O simple_l2d_pha_201810-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456505 -O simple_l2d_pha_201810-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456507 -O simple_l2d_pha_201810-5.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456503 -O simple_l2d_pha_201810-6.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456510 -O simple_l2d_pha_201811.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456506 -O simple_l2d_pha_201901.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456513 -O simple_l2d_pha_201902-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13456502 -O simple_l2d_pha_201902-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455536 -O simple_l2d_pha_201903-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455533 -O simple_l2d_pha_201903-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455538 -O simple_l2d_pha_201904.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455537 -O simple_l2d_pha_201905-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455535 -O simple_l2d_pha_201905-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455521 -O simple_l2d_pha_201905-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455525 -O simple_l2d_pha_201906-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455526 -O simple_l2d_pha_201906-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455529 -O simple_l2d_pha_201907-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455532 -O simple_l2d_pha_201907-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455528 -O simple_l2d_pha_201907-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455523 -O simple_l2d_pha_201907-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455531 -O simple_l2d_pha_201908.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455524 -O simple_l2d_pha_201909.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455522 -O simple_l2d_pha_201910-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455527 -O simple_l2d_pha_201910-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455530 -O simple_l2d_pha_201910-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13455534 -O simple_l2d_pha_201911.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448186 -O simple_l2d_res_201806.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448200 -O simple_l2d_res_201807-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448212 -O simple_l2d_res_201807-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448199 -O simple_l2d_res_201808-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448198 -O simple_l2d_res_201808-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448192 -O simple_l2d_res_201809-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448195 -O simple_l2d_res_201809-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448208 -O simple_l2d_res_201810-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448197 -O simple_l2d_res_201810-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448204 -O simple_l2d_res_201810-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448202 -O simple_l2d_res_201810-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448214 -O simple_l2d_res_201810-5.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448209 -O simple_l2d_res_201810-6.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448196 -O simple_l2d_res_201811.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448219 -O simple_l2d_res_201901.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448194 -O simple_l2d_res_201902-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448206 -O simple_l2d_res_201902-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448190 -O simple_l2d_res_201903-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448207 -O simple_l2d_res_201903-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448193 -O simple_l2d_res_201904.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448191 -O simple_l2d_res_201905-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448217 -O simple_l2d_res_201905-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448185 -O simple_l2d_res_201905-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448189 -O simple_l2d_res_201906-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448205 -O simple_l2d_res_201906-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448218 -O simple_l2d_res_201907-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448216 -O simple_l2d_res_201907-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448187 -O simple_l2d_res_201907-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448213 -O simple_l2d_res_201907-4.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448211 -O simple_l2d_res_201908.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448210 -O simple_l2d_res_201909.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448203 -O simple_l2d_res_201910-1.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448215 -O simple_l2d_res_201910-2.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448188 -O simple_l2d_res_201910-3.zip
wget https://dataverse.harvard.edu/api/access/datafile/13448201 -O simple_l2d_res_201911.zip

######################################################
####         2．Files and Directories             ####

File                                  Descriptions
./ReadMeFirst.pptx                    shows the spatial relationships and general information of the mosaics
./ReadMeSecond.txt                    This file. contains tutorials and file description
./SUMFILES.zip                        contains SUMFILE-styled camera geometry information
./onc_camerainfo.txt                  Geometry information of each ONC image:minimum/maximum values of resolution/latitude/longitude and distance/resolution/latitude/longitude of the corners and center of each image
./mosaic/                             contains mosaics created by this research
./mosaic/info.zip                     contains information file of mosaics created by this research
    - ONCTmosaic_GlobalRes...png      Global resolution map of ONC-T images utilized in the mosaics. Color bar is color-bar53.bmp (Min:3mm Max:1000mm) in logscale. This is a resolution map of the ONC-T image, created by removing the portion with a large emission angle and remaining the portion with favorable imaging conditions.   
    - color-bar53.bmp                 color bar 
    - mosaic_info.xlsx                information (size, lon, lat, resolution, and description) of mosaic maps
    - paper.pdf                       the paper of this research 
    - footprints.gpkg                 footprints of mosaic maps
    - GlobalResolutionMap_ONCT...png  Global resolution map of all ONC-T image.  Color bar is color-bar53.bmp (Min:3mm Max:2000mm) in logscale.
    - GlobalResolutionMap_ONCW1...png Global resolution map of all ONC-W1 image. Color bar is color-bar53.bmp (Min:2mm Max:20000mm) in logscale.
    - GlobalResolutionMap_ONCW2...png Global resolution map of all ONC-W2 image. Color bar is color-bar53.bmp (Min:2mm Max:20000mm) in logscale.
    - GlobalResolutionMap_ONCT.tif    Global resolution map of all ONC-T image.  Unit is mm/px.
    - GlobalResolutionMap_ONCW1.tif   Global resolution map of all ONC-W1 image. Unit is mm/px.
    - GlobalResolutionMap_ONCW2.tif   Global resolution map of all ONC-W2 image. Unit is mm/px.
./mosaic/GLOBAL.zip                   the global mosaic map of Ryugu
    - ryugu_global.tif                GeoTIFF-formatted map-projected file of the global mosaic map. See also Section 3.
    - ryugu_global.png                png file exported from ryugu_global.tif, with the blue, green, and red channels assigned to the ul-band, v-band, and p-band, respectively. 
    - ryugu_global_color_enhanced.png Enhanced color map of ryugu_global.png
    - ryugu_global.lis                list of images used to create ryugu_global.tif 
./mosaic/MINERVA.zip                  mosaic maps and associated file for MINERVA region
    - MINERVAregion.png               mosaic map of Minerva region created from l2b images
    - MINERVAregion_grid.png          the MINERVAregion.png with grid and scale (blue scale bar in bottom left coner is 10 m) 
    - MINERVAregion_res...png         resolution map of Minerva region. Min:0 mm Max:140mm  
    - color-bar52.bmp                 color bar of MINERVAregion_res...png
    - ryugu_minerva*.tif              GeoTIFF-formatted map-projected file from MINERVA-II1 deployment operation on 20180921
    - ryugu_minerva1.tif              mosaic map of minerva 1 region. See also Section 2. 
    - ryugu_minerva1.png              PNG format image exported from ryugu_minerva1.tif Grayscale portion is l2b image (band 1 of ryugu_minerva1.tif) and color portion from band 3,7,9.
    - ryugu_minerva1_grid.png         ryugu_minerva1.png with grid and scale (red scale bar in bottom left coner is 1 m)
    - ryugu_minerva1.lis              list of images used to create ryugu_minerva1.lis 
    - ryugu_minerva*.tif/png/lis      Same as ryugu_minerva1.tif/png/lis
./mosaic/MASCOT.zip                   mosaic maps for MASCOT region
    - ryugu_mascot*.tif               from MASCOT deployment operation on 20181003
    - ryugu_mascot*.tif/png/lis       Same as ryugu_minerva1.tif/png/lis
./mosaic/REGIONAL-*.zip               mosaic maps for regional observations. Split into 2 zip files
    - ryugu_northpole.tif             from BOX-B4 operation to the north pole on 20190124 in polar projection
    - ryugu_southpole.tif             from BOX-B1 operation to the south pole on 20180824 in polar projection
    - ryugu_midalt.tif                from medium altitude observations 2 on 20181003
    - ryugu_20190321.tif              from artificial crater search operation (CRA1) on 20190321 (before the SCI experiment)
    - ryugu_20190425.tif              from artificial crater search operation (CRA2) on 20190425 (after the SCI experiment)
    - ryugu_gravity.tif               from operation to measure the gravity of Ryugu on 20180806
./mosaic/TD1-*.zip                    mosaic maps for touch down 1 region. Split into 2 zip files
    - ryugu_td1e*.tif                 ONC-W mosaics from the three descent observations for TD1 (20181015, 20181025, and 20190221)
    - ryugu_td1h*.tif                 ONC-T mosaics from the three descent observations for TD1 (20181015, 20181025, and 20190221)
./mosaic/TD2-*.zip                    mosaic maps for touch down 2 region. Split into 4 zip files
    - ryugu_td2f*.tif                 ONC-W mosaics from the five descent observations for TD2 (20190308,20190516,20190530,20190613,20190711)
    - ryugu_td2g*.tif                 ONC-T mosaics from the five descent observations for TD2 (20190308,20190516,20190530,20190613,20190711)
./map/                                contains maps created from ONC images. Although bicubic interpolation is applied, the pixel values are intact from the original l2b/l2d image.
./map/north_l2b_image/                contains north polar azimuthal equidistant projection maps created from l2b images.
./map/north_l2d_image/                contains north polar azimuthal equidistant projection maps created from l2d images.
./map/north_l2b_eirp/                 contains emission/solar incidence/resolution/phase maps of north polar l2b maps. Unit is degree for emission/solar incidence/phase angle map and millimeter per px for resolution map.
./map/north_l2d_eirp/                 contains emission/solar incidence/resolution/phase maps of north polar l2d maps. Unit is degree for emission/solar incidence/phase angle map and millimeter per px for resolution map.
./map/south_l2b_image/                contains south polar azimuthal equidistant projection maps created from l2b images.
./map/south_l2d_image/                contains south polar azimuthal equidistant projection maps created from l2d images.
./map/south_l2b_eirp/                 contains emission/solar incidence/resolution/phase maps of south polar l2b maps. Unit is degree for emission/solar incidence/phase angle map and millimeter per px for resolution map.
./map/south_l2d_eirp/                 contains emission/solar incidence/resolution/phase maps of south polar l2d maps. Unit is degree for emission/solar incidence/phase angle map and millimeter per px for resolution map.
./map/simple_l2b_image/               contains simple cylindrical projection maps created from l2b images.
./map/simple_l2d_image/               contains simple cylindrical projection maps created from l2d images.
./map/simple_l2b_eirp/                contains emission/solar incidence/resolution/phase maps of simple cylindrical l2b maps. Unit is degree for emission/solar incidence/phase angle map and millimeter per px for resolution map.
./map/simple_l2d_eirp/                contains emission/solar incidence/resolution/phase maps of simple cylindrical l2d maps. Unit is degree for emission/solar incidence/phase angle map and millimeter per px for resolution map.
./map/north_l2b_image/north_l2b_img_201809.zip         contains north polar l2b maps captured in Sep. 2018
                      north_l2b_img_201901-*.zip       contains north polar l2b maps captured in Jan. 2019. Split into 3 zip files.
                      north_l2b_img_201902.zip         contains north polar l2b maps captured in Feb. 2019
                      north_l2b_img_201903.zip         contains north polar l2b maps captured in Mar. 2019
                      north_l2b_img_201907.zip         contains north polar l2b maps captured in Jul. 2019
                      north_l2b_img_201910.zip         contains north polar l2b maps captured in Oct. 2019
./map/north_l2b_eirp/north_l2b_emi_201809.zip          contains emission        angle maps (in degree) of north polar l2b maps captured in Sep. 2018
                     north_l2b_inc_201809.zip          contains solar incidence angle maps (in degree) of north polar l2b maps captured in Sep. 2018
                     north_l2b_res_201809.zip          contains resolution            maps (in mm/px)  of north polar l2b maps captured in Sep. 2018
                     north_l2b_pha_201809.zip          contains phase           angle maps (in degree) of north polar l2b maps captured in Sep. 2018


######################################################
####   3．Mosaic Map (./mosaic/***/ryugu_***.tif) ####

Mosaic maps have the following band structure. (except for ryugu_northpole.tif and ryugu_southpole.tif).

Band 1     l2b map. Contrast and min/max of pixel value was modified to match l2d images.(this band is the same as tvf band in some mosaics)    
Band 2     resolution map of original l2b images in mm/px (millimeter per pixel), not meter per pixel
Band 3     v-band l2d map. (this band is w1f or w2f in some mosaics)  
Band 4     w-band l2d map.
Band 5     x-band l2d map.
Band 6     n-band l2d map.
Band 7     p-band l2d map.
Band 8     b-band l2d map.
Band 9     ul-band l2d map.

When performing map projection, pixel values are interpolated using bicubic interpolation.

Band 1 is derived from l2b images, preserving all pixel values across the Field of View (FOV), making it suitable for geomorphology studies such as crater counting, boulder counting, and size measurment of craters and boulders. Note that all pixels in l2b were remained, while many outer pixels in l2d were cropped. When ONC-T l2d images are created from l2c/l2b images, outer original pixels were interpreted as invalid pixels. When ONC-W l2d images are created, many outer original pixels were cropped to remove camera distortion. The pixel value in this band were processed to adjust contrast and brightness closer to l2d images, therefore, the pixel values in band 1 are not optically correct.

Bands 3-9 are derived from l2d images (optically corrected images). Although bicubic interpolation is applied, the values are intact from the original l2d image, making these bands suitable for photometry studies, such as examining color ratios or absolute brightness measurements. Bands 3 to 9 are cropped to only the areas overlapping with other bands captured simultaneously.

However, l2d bands of global mosaic (ryugu_global.tif) and polar maps (ryugu_northpole.tif and ryugu_southpole.tif) are not intact because the brightness and contrast were matched with images captured on another date when combining these maps. Therefore, these mosaics may be not suitable for photometry studies.

Mosaic maps of ryugu_northpole.tif and ryugu_southpole.tif have the following band structure.
Band 1     v-band l2d map.
Band 2     w-band l2d map. 　
Band 3     x-band l2d map.
Band 4     n-band l2d map.
Band 5     p-band l2d map.
Band 6     b-band l2d map.
Band 7     ul-band l2d map.

more detail info can be obtained by "gdalinfo" command
We described those infos in ./mosaic/info/mosaic_info.xlsx   


As an example, to see information about ryugu_td2g1.tif, we can use the following command:

gdalinfo -mm ryugu_td2g1.tif

Then, we can obtain the following info:
190 pixel per degree, about 0.041153 m/px: (l2b) Mosaic of l2b images. Prior to mosaicking, the brightness and contrast of l2b images are matched to hyb2_onc_20181003_162940_tvf_l2d: (resolution) the original resolution of l2b images of this mosaic in millimeter per pixel: (tvf-tuf) l2d images of v/w/x/n/p/b/u-band. 7-band observation was carried out. The brightness and contrast of l2d images are not modified

./mosaic/mosaic_info.xlsx  contains the same description.
  
The list of images used to create ryugu_td2g1.tif is shown in ryugu_td2g1.lis.
ryugu_td2g1.png is PNG format image exported from ryugu_td2g1.tif, where grayscale portion is l2b image (band 1) and color portion from band 3,7,9.

ryugu_***_grid.png shows latitude and longitude lines on a 5-degree or 1-degree grid (1 degree of latitude corresponds to approximately 7.8 meters). 
The blue scale bar at the bottom right represents 10 meter 
The red scale bar 1 meters.

#################################################################################################
####   4．Geotiff Map File (./map/***/hyb2_onc_***.tif) ####


North polar azimuthal projection maps created from the original ONC images are included in ./map/north_l2b_image/ or ./map/north_l2d_image/
South polar azimuthal projection maps created from the original ONC images are included in ./map/south_l2b_image/ or ./map/south_l2d_image/
Simple cylindrical projection maps created from the original ONC images are included in ./map/simple_l2b_image/ or ./map/simple_l2d_image/

For example, 
north_l2b_img_201809.zip contains north polar azimuthal projection maps created from the ONC l2b images captured in Sep. 2018.
simple_l2d_img_201806.zip contains Simple cylindrical projection maps created from the ONC l2d images captured in June 2018.

Emission angle map, solar incidence angle map, phase angle map, and resolution map are included in ./map/***_l2b_eirp/ or ./map/***_l2d_eirp/   

For example, 
north_l2b_res_201809.zip includes the resolution map of north_l2b_res_201809.zip
simple_l2d_pha_201806.zip includes the phase angle map of simple_l2d_img_201806.zip

To reduce the size of zip file less than approximately 2.0 GB, some directories are split into several zip files.
For example, Simple cylindrical projection maps captured in Oct. 2018 are split into 6 zip files.
simple_l2b_img_201810-1.zip 
simple_l2b_img_201810-2.zip 
simple_l2b_img_201810-3.zip 
simple_l2b_img_201810-4.zip 
simple_l2b_img_201810-5.zip 
simple_l2b_img_201810-6.zip 

As an example, 
simple_l2b_img_201810-6.zip contains hyb2_onc_20181031_234739_tbf_l2b.tif
hyb2_onc_20181031_234739_tbf_l2b.tif is created from hyb2_onc_20181031_234739_tbf_l2b.fit file. This original fit file is DARTS at JAXA.
hyb2_onc_20181031_234739_tbf_l2b_emission.tif   is the emission        angle map of hyb2_onc_20181031_234739_tbf_l2b.tif Here, unit is degree and this file is included in simple_l2b_emi_201810-6.zip 
hyb2_onc_20181031_234739_tbf_l2b_incidence.tif  is the solar incidence angle map of hyb2_onc_20181031_234739_tbf_l2b.tif Here, unit is degree and this file is included in simple_l2b_inc_201810-6.zip 
hyb2_onc_20181031_234739_tbf_l2b_phase.tif      is the phase           angle map of hyb2_onc_20181031_234739_tbf_l2b.tif Here, unit is degree and this file is included in simple_l2b_pha_201810-6.zip 
hyb2_onc_20181031_234739_tbf_l2b_resolution.tif is the resolution            map of hyb2_onc_20181031_234739_tbf_l2b.tif Here, unit is mm/px and this file is included in simple_l2b_res_201810-6.zip 

The pixel values of those map files are intact from the original l2b or l2d fit file, although bicubic interpolation with reflect boundary conditions is applied.
No optical corrections such as hapke correction or Lambertian correction have been applied.

######################################################
####   5．Tutorials  (Gdal command)               ####

# QGIS is a useful viewer of geotiff files.

# Here we show an example of GDAL commands to process geotiff maps.
# For example, to export PNG image, we can use the following command:

mos="ryugu_td2g1"
gdal_translate -b 1 -scale 0 0.07 0 255 -ot Float32 -of PNG ${mos}.tif ${mos}_1.png
gdal_translate -b 2 -scale 0 1000  0 255 -ot Float32 -of PNG ${mos}.tif ${mos}_2.png
gdal_translate -b 3 -scale 0 0.07 0 255 -ot Float32 -of PNG ${mos}.tif ${mos}_3.png
gdal_translate -b 4 -scale 0 0.07 0 255 -ot Float32 -of PNG ${mos}.tif ${mos}_4.png
gdal_translate -b 5 -scale 0 0.07 0 255 -ot Float32 -of PNG ${mos}.tif ${mos}_5.png
gdal_translate -b 6 -scale 0 0.07 0 255 -ot Float32 -of PNG ${mos}.tif ${mos}_6.png
gdal_translate -b 7 -scale 0 0.07 0 255 -ot Float32 -of PNG ${mos}.tif ${mos}_7.png
gdal_translate -b 8 -scale 0 0.07 0 255 -ot Float32 -of PNG ${mos}.tif ${mos}_8.png
gdal_translate -b 9 -scale 0 0.07 0 255 -ot Float32 -of PNG ${mos}.tif ${mos}_9.png


# To combine all mosaics in the TD1 region, we can use the following command:

gdal_merge -ul_lr 133 30 268 -17 -o TD1area.tif -ot Float32 -co COMPRESS=LZW ryugu_td1h8.tif ryugu_td1h10.tif ryugu_td1h6.tif ryugu_td1h7.tif ryugu_td1h9.tif ryugu_td1h1.tif ryugu_td1h2.tif ryugu_td1h3.tif ryugu_td1h4.tif ryugu_td1h51.tif ryugu_td1h53.tif ryugu_td1h54.tif ryugu_td1h52.tif ryugu_td1h531.tif ryugu_td1h532.tif ryugu_td1h533.tif ryugu_minerva6.tif

# TD1area.tif is created by the above command. 
# Similarly, to combine all mosaics in the TD2/minerva/mascot region, you can use the following command:

gdal_merge -ul_lr 280.9 44 336 -0.5 -o TD2area.tif -ot Float32 -co COMPRESS=LZW -co BIGTIFF=yes ryugu_td2g2.tif ryugu_td2g3.tif ryugu_td2g4.tif ryugu_td2g7.tif ryugu_td2g9.tif ryugu_td2g82.tif  ryugu_td2g83.tif  ryugu_td2g85.tif ryugu_td2g81.tif  ryugu_td2g86.tif ryugu_td2g84.tif ryugu_td2g87.tif ryugu_td2g88.tif ryugu_td2g51.tif ryugu_td2g52.tif ryugu_td2g53.tif ryugu_td2g61.tif ryugu_td2g62.tif ryugu_td2g63.tif 

gdal_merge -ul_lr 93 32 157 8 -o Minerva_area.tif -ot Float32 -co COMPRESS=LZW ryugu_minerva1.tif ryugu_minerva2.tif ryugu_minerva3.tif ryugu_minerva4.tif

gdal_merge -ul_lr 299 -14 352 -32 -o Mascot_area.tif -ot Float32 -co COMPRESS=LZW -co BIGTIFF=yes ryugu_mascot4.tif  ryugu_mascot6.tif ryugu_mascot1.tif ryugu_mascot2.tif ryugu_mascot3.tif ryugu_mascot4.tif


# For example, to overlay a local mosaic onto a global mosaic, we can use the following command:

gdal_merge -ul_lr 133 30 268 -17 -o TD1areaGlobal.tif -ot Float32 -co COMPRESS=LZW ryugu_td1h8.tif ryugu_global.tif

gdal_merge -ul_lr 280.9 44 336 -0.5 -o TD2areaGlobal.tif -ot Float32 -co COMPRESS=LZW -co BIGTIFF=yes ryugu_td2g2.tif ryugu_global.tif

gdal_merge -ul_lr 93 32 157 8 -o Minerva_areaGlobal.tif -ot Float32 -co COMPRESS=LZW ryugu_minerva1.tif ryugu_global.tif

gdal_merge -ul_lr 299 -14 352 -32 -o Mascot_areaGlobal.tif -ot Float32 -co COMPRESS=LZW -co BIGTIFF=yes ryugu_mascot4.tif ryugu_global.tif


######################################################
####   6．Tutorials  (Gdal Python package)        ####
#
# Here we show an example of Gdal Python package to process geotiff maps.
# Python enables more complex processing.
# As an example, we show the Python code to create a mosaic of ryugu_td2g4 region.
# image list is included in ./mosaic/TD2/ryugu_td2g4.lis 
# Those geotiff map files are included in simple_l2b_img_201903-1.zip and simple_l2b_img_201905-1.zip
# The following code (Python Code Example 1) can combine all maps entered into input_files into a single map file.
#
#### Python Code Example 1 ##########
from osgeo import gdal
input_files = [
"hyb2_onc_20190308_030548_tvf_l2b.tif",
"hyb2_onc_20190308_030600_twf_l2b.tif",
"hyb2_onc_20190308_030620_txf_l2b.tif",
"hyb2_onc_20190308_030632_tnf_l2b.tif",
"hyb2_onc_20190308_030652_tpf_l2b.tif",
"hyb2_onc_20190308_030704_tbf_l2b.tif",
"hyb2_onc_20190308_030724_tuf_l2b.tif",
"hyb2_onc_20190516_021106_tvf_l2b.tif",
"hyb2_onc_20190516_021118_twf_l2b.tif",
"hyb2_onc_20190516_021138_txf_l2b.tif",
"hyb2_onc_20190516_021151_tnf_l2b.tif",
"hyb2_onc_20190516_021210_tpf_l2b.tif",
"hyb2_onc_20190516_021222_tbf_l2b.tif",
"hyb2_onc_20190516_021242_tuf_l2b.tif"]

output_file = "map_td2g4.tif"

gdal.Warp(output_file, input_files, format="GTiff", resampleAlg="cubic")

exit()
#####################################
#
# The following code (Python Code Example 2) re-projects one map image onto the coordinates of another map image.
# This is useful to obtain the value of color ratio or absolute brightness ratio, or to create color composite map.
# Those geotiff map files are included in simple_l2d_img_201903-1.zip
#
#### Python Code Example 2 ##########
from osgeo import gdal

input_file="hyb2_onc_20190308_030724_tuf_l2d.tif"
reference= "hyb2_onc_20190308_030548_tvf_l2d.tif"

ref=gdal.Open(reference)
refsrs=ref.GetProjection()
ref_gt=ref.GetGeoTransform()
ref_w=ref.RasterXSize
ref_h=ref.RasterYSize

output_file="output.tif"

gdal.Warp(output_file, input_file,dstSRS=refsrs,width=ref_w,height=ref_h,outputBounds=[ref_gt[0],ref_gt[3]+ref_gt[5]*ref_h,ref_gt[0]+ref_gt[1]*ref_w,ref_gt[3]], format="GTiff", resampleAlg="cubic")

exit()
#####################################
#
# The following code (Python Code Example 3) performs masking to replace areas with emission angles of 45 degrees or greater with no data values.
# Those geotiff map files are included in simple_l2b_img_201903-1.zip and simple_l2b_emi_201903-1.zip
#
#### Python Code Example 3 ##########
import numpy as np
from osgeo import gdal
org="hyb2_onc_20190308_030725_w1f_l2d.tif"
emi="hyb2_onc_20190308_030725_w1f_l2d_emission.tif"
#inc="hyb2_onc_20190308_030725_w1f_l2d_incidence.tif"
#pha="hyb2_onc_20190308_030725_w1f_l2d_phase.tif"
#res="hyb2_onc_20190308_030725_w1f_l2d_resolution.tif"

outputfilename="mask.tif"
threshold = 45

img = gdal.Open(org)
mask = gdal.Open(emi)
band1 = img.GetRasterBand(1)
band2 = mask.GetRasterBand(1)
data1 = band1.ReadAsArray()
data2 = band2.ReadAsArray()
nodata_value = band1.GetNoDataValue()

data1[data2 >= threshold] = nodata_value

driver = gdal.GetDriverByName("GTiff")
output = driver.Create(outputfilename,img.RasterXSize,img.RasterYSize, 1, band1.DataType)
output.SetGeoTransform(img.GetGeoTransform())
output.SetProjection(img.GetProjection())
out_band = output.GetRasterBand(1)
out_band.WriteArray(data1)
out_band.SetNoDataValue(nodata_value)
out_band.FlushCache()

exit()

#####################################

# By combining these codes, you will be able to create various mosaics and original color composite maps!
