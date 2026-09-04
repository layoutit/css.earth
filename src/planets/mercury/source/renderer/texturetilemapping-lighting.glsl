// Exact lighting excerpts from OpenSpace commit
// 56e29b54b8592084ff1fef47c2e08de0b22ce516:
// modules/globebrowsing/shaders/texturetilemapping.glsl
// Upstream full-file SHA-256:
// c2388a626700e4b4c7c09894e8d15e402c7c53d67cb24c4d8a1cebbacf4745d4

float orenNayarDiffuse(vec3 lightDirection, vec3 viewDirection, vec3 surfaceNormal,
                       float roughness)
{
  // calculate intermediary values
  float NdotL = dot(surfaceNormal, lightDirection);
  float NdotV = dot(surfaceNormal, viewDirection);

  float angleVN = acos(NdotV);
  float angleLN = acos(NdotL);

  float alpha = max(angleVN, angleLN);
  float beta = min(angleVN, angleLN);
  float gamma = dot(
    viewDirection - surfaceNormal * dot(viewDirection, surfaceNormal),
    lightDirection - surfaceNormal * dot(lightDirection, surfaceNormal)
  );

  float roughnessSquared = roughness * roughness;

  // calculate A and B
  float a = 1.0 - 0.5 * (roughnessSquared / (roughnessSquared + 0.57));
  float b = 0.45 * (roughnessSquared / (roughnessSquared + 0.09));
  float c = sin(alpha) * tan(beta);

  // put it all together
  return max(0.0, NdotL) * (a + b * max(0.0, gamma) * c);
}

vec4 calculateShadedColor(vec4 currentColor, vec3 ellipsoidNormalCameraSpace,
                          vec3 lightDirectionCameraSpace, vec3 viewDirectionCameraSpace,
                          float roughness, float ambientIntensity)
{
  vec3 shadedColor = currentColor.rgb * ambientIntensity;

  vec3 n = normalize(ellipsoidNormalCameraSpace);

  float power = orenNayarDiffuse(-lightDirectionCameraSpace, viewDirectionCameraSpace,
    ellipsoidNormalCameraSpace, roughness);

  vec3 l = lightDirectionCameraSpace;
  power = max(smoothstep(0.0, 0.1, max(dot(-l, n), 0.0)) * power, 0.0);

  vec4 color = vec4(shadedColor + currentColor.rgb * power, currentColor.a);
  return color;
}
