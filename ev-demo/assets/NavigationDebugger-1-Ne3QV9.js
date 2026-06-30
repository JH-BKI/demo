import{j as v,V as y,b7 as Ae,I as Pe,z5 as we,wi as h,Q as Ce,v9 as U,T as k,L as E,w as Le,o as Ee,k as F,fJ as Me,S as B,s as xe,AZ as Re,C as O,a7 as De,fo as Ie,ab as b}from"./index-CrSZ4RlP.js";const Oe=new Pe(y.Zero(),y.Zero());class vt{constructor(){this._inverseViewProjectionMatrixWithoutTranslation=v.Identity(),this._directionToLightRelativeToCameraGeocentricNormal=y.Up(),this._cosAngleLightToZenith=0,this._cameraRadius=0,this._clampedCameraRadius=0,this._cameraHeight=0,this._clampedCameraHeight=0,this._cameraPositionGlobal=new y,this._clampedCameraPositionGlobal=new y,this._cosCameraHorizonAngleFromZenith=0,this._sinCameraAtmosphereHorizonAngleFromNadir=0,this._cameraGeocentricNormal=y.Up(),this._cameraForward=y.Down(),this._cameraNearPlane=0,this._cameraPosition=new y,this._viewport=new Ae,this._lastViewMatrix=v.Identity(),this._lastProjectionMatrix=v.Identity(),this._inverseViewMatrixWithoutTranslation=v.Identity(),this._inverseProjectionMatrix=v.Identity()}get inverseViewProjectionMatrixWithoutTranslation(){return this._inverseViewProjectionMatrixWithoutTranslation}get directionToLightRelativeToCameraGeocentricNormal(){return this._directionToLightRelativeToCameraGeocentricNormal}get cosAngleLightToZenith(){return this._cosAngleLightToZenith}get cameraRadius(){return this._cameraRadius}get clampedCameraRadius(){return this._clampedCameraRadius}get cameraHeight(){return this._cameraHeight}get clampedCameraHeight(){return this._clampedCameraHeight}get cameraPositionGlobal(){return this._cameraPositionGlobal}get clampedCameraPositionGlobal(){return this._clampedCameraPositionGlobal}get cosCameraHorizonAngleFromZenith(){return this._cosCameraHorizonAngleFromZenith}get sinCameraAtmosphereHorizonAngleFromNadir(){return this._sinCameraAtmosphereHorizonAngleFromNadir}get cameraGeocentricNormal(){return this._cameraGeocentricNormal}get cameraForward(){return this._cameraForward}get cameraNearPlane(){return this._cameraNearPlane}get cameraPosition(){return this._cameraPosition}get viewport(){return this._viewport}update(e,t,i,a,n,o){this._cameraNearPlane=e.minZ,this._cameraForward.copyFrom(e.getForwardRayToRef(Oe,1).direction);const l=e.getScene(),c=l.getEngine();this._viewport.copyFromFloats(0,0,c.getRenderWidth(),c.getRenderHeight());const d=e.getViewMatrix(),s=e.getProjectionMatrix(),m=this._lastViewMatrix,p=this._lastProjectionMatrix;(!m.equals(d)||!p.equals(s))&&(m.copyFrom(d),m.setTranslation(y.ZeroReadOnly),m.invertToRef(this._inverseViewMatrixWithoutTranslation),p.copyFrom(s),p.invertToRef(this._inverseProjectionMatrix),this._inverseProjectionMatrix.multiplyToRef(this._inverseViewMatrixWithoutTranslation,this._inverseViewProjectionMatrixWithoutTranslation));const u=this._cameraPosition.copyFrom(e.globalPosition).scaleToRef(.001,this._cameraPositionGlobal);l.floatingOriginMode?(u.normalizeToRef(this._cameraGeocentricNormal),this._cameraGeocentricNormal.scaleAndAddToRef(o,u)):(u.y+=t+o,u.normalizeToRef(this._cameraGeocentricNormal)),this._cameraRadius=u.length(),this._cameraHeight=this._cameraRadius-t,this._clampedCameraRadius=this._cameraRadius,this._clampedCameraRadius<i?(this._clampedCameraRadius=i,this._cameraGeocentricNormal.scaleToRef(i,this._clampedCameraPositionGlobal)):this._clampedCameraPositionGlobal.copyFrom(u),this._cosCameraHorizonAngleFromZenith=be(t,this._clampedCameraRadius),this._sinCameraAtmosphereHorizonAngleFromNadir=Math.min(1,a/this._clampedCameraRadius),this._clampedCameraHeight=this._clampedCameraRadius-t;{this._cosAngleLightToZenith=we(n,this._cameraGeocentricNormal);const f=Math.sqrt(Math.max(0,1-this._cosAngleLightToZenith*this._cosAngleLightToZenith));this._directionToLightRelativeToCameraGeocentricNormal.copyFromFloats(f,this._cosAngleLightToZenith,0),this._directionToLightRelativeToCameraGeocentricNormal.normalize()}}}const be=(r,e)=>{const t=Math.min(1,r/e);return-Math.sqrt(1-t*t)},Y="atmosphereFragmentDeclaration",Ne=`uniform vec3 peakRayleighScattering;uniform float planetRadius;uniform vec3 peakMieScattering;uniform float atmosphereThickness;uniform vec3 peakMieAbsorption;uniform float planetRadiusSquared;uniform vec3 peakMieExtinction;uniform float atmosphereRadius;uniform vec3 peakOzoneAbsorption;uniform float atmosphereRadiusSquared;uniform float horizonDistanceToAtmosphereEdge;uniform float horizonDistanceToAtmosphereEdgeSquared;uniform float planetRadiusWithOffset;uniform float planetRadiusOffset;uniform float atmosphereExposure;uniform float aerialPerspectiveRadianceBias;uniform float inverseAtmosphereThickness;uniform float aerialPerspectiveTransmittanceScale;uniform mat4 inverseViewProjectionWithoutTranslation;uniform vec3 directionToLight;uniform float multiScatteringIntensity;uniform vec3 directionToLightRelativeToCameraGeocentricNormal;uniform float cameraRadius;uniform vec3 lightRadianceAtCamera;uniform float diffuseSkyIrradianceDesaturationFactor;uniform vec3 groundAlbedo;uniform float aerialPerspectiveSaturation;uniform vec3 minMultiScattering;uniform float diffuseSkyIrradianceIntensity;uniform vec3 cameraPositionGlobal;uniform float lightIntensity;uniform vec3 clampedCameraPositionGlobal;uniform float aerialPerspectiveIntensity;uniform vec3 cameraGeocentricNormal;uniform float clampedCameraRadius;uniform vec3 cameraForward;uniform float clampedCameraHeight;uniform vec3 cameraPosition;uniform float cosCameraHorizonAngleFromZenith;uniform vec4 viewport;uniform vec3 additionalDiffuseSkyIrradiance;uniform float cameraHeight;uniform float cameraNearPlane;uniform float originHeight;uniform float sinCameraAtmosphereHorizonAngleFromNadir;
`;h.IncludesShadersStore[Y]||(h.IncludesShadersStore[Y]=Ne);const K="atmosphereUboDeclaration",Fe=`layout(std140,column_major) uniform;uniform Atmosphere {vec3 peakRayleighScattering;float planetRadius;vec3 peakMieScattering;float atmosphereThickness;vec3 peakMieAbsorption;float planetRadiusSquared;vec3 peakMieExtinction;float atmosphereRadius;vec3 peakOzoneAbsorption;float atmosphereRadiusSquared;float horizonDistanceToAtmosphereEdge;float horizonDistanceToAtmosphereEdgeSquared;float planetRadiusWithOffset;float planetRadiusOffset;float atmosphereExposure;float aerialPerspectiveRadianceBias;float inverseAtmosphereThickness;float aerialPerspectiveTransmittanceScale;mat4 inverseViewProjectionWithoutTranslation;vec3 directionToLight;float multiScatteringIntensity;vec3 directionToLightRelativeToCameraGeocentricNormal;float cameraRadius;vec3 lightRadianceAtCamera;float diffuseSkyIrradianceDesaturationFactor;vec3 groundAlbedo;float aerialPerspectiveSaturation;vec3 minMultiScattering;float diffuseSkyIrradianceIntensity;vec3 cameraPositionGlobal;float lightIntensity;vec3 clampedCameraPositionGlobal;float aerialPerspectiveIntensity;vec3 cameraGeocentricNormal;float clampedCameraRadius;vec3 cameraForward;float clampedCameraHeight;vec3 cameraPosition;float cosCameraHorizonAngleFromZenith;vec4 viewport;vec3 additionalDiffuseSkyIrradiance;float cameraHeight;float cameraNearPlane;float originHeight;float sinCameraAtmosphereHorizonAngleFromNadir;};
`;h.IncludesShadersStore[K]||(h.IncludesShadersStore[K]=Fe);const J="depthFunctions",ze=`float reconstructDistanceFromCameraPlane(float depth,float cameraNearPlane) {return cameraNearPlane/(1.0-depth);}
float sampleDistanceFromCameraPlane(sampler2D depthTexture,vec2 uv,float cameraNearPlane) {float depth=textureLod(depthTexture,uv,0.).r;return depth>=1. ? 0. : reconstructDistanceFromCameraPlane(depth,cameraNearPlane);}
float reconstructDistanceFromCamera(float depth,vec3 cameraRayDirection,vec3 cameraForward,float cameraNearPlane) {float distanceFromCameraPlane=reconstructDistanceFromCameraPlane(depth,cameraNearPlane);return distanceFromCameraPlane/max(0.00001,dot(cameraForward,cameraRayDirection));}
float reconstructDistanceFromCamera(
sampler2D depthTexture,
vec2 uv,
vec3 cameraRayDirection,
vec3 cameraForward,
float cameraNearPlane) {float depth=textureLod(depthTexture,uv,0.).r;return depth>=1. ? 0. : reconstructDistanceFromCamera(depth,cameraRayDirection,cameraForward,cameraNearPlane);}`;h.IncludesShadersStore[J]||(h.IncludesShadersStore[J]=ze);const X="atmosphereFunctions",He=`#include<intersectionFunctions>
const vec2 MultiScatteringLutSize=vec2(32.0,32.0);const vec2 MultiScatteringLutDomainInUVSpace=(MultiScatteringLutSize-vec2(1.0))/MultiScatteringLutSize;const vec2 MultiScatteringLutHalfTexelSize=vec2(0.5)/MultiScatteringLutSize;const float NumAerialPerspectiveLutLayers=32.0;const vec3 AerialPerspectiveLutSize=vec3(16.0,64.0,NumAerialPerspectiveLutLayers);const vec2 DiffuseSkyIrradianceLutSize=vec2(64.0,16.0);const vec2 DiffuseSkyIrradianceLutDomainInUVSpace=(DiffuseSkyIrradianceLutSize-vec2(1.0))/DiffuseSkyIrradianceLutSize;const vec2 DiffuseSkyIrradianceLutHalfTexelSize=vec2(0.5)/DiffuseSkyIrradianceLutSize;const vec2 SkyViewLutSize=vec2(128.0,128.0);const vec2 SkyViewLutDomainInUVSpace=(SkyViewLutSize-vec2(1.0))/SkyViewLutSize;const vec2 SkyViewLutHalfTexelSize=vec2(0.5)/SkyViewLutSize;const float AerialPerspectiveLutKMPerSlice=4.0;const float AerialPerspectiveLutRangeKM=AerialPerspectiveLutKMPerSlice*NumAerialPerspectiveLutLayers;const float TransmittanceSampleCount=128.0;const float SkyViewLutSampleCount=30.0;const vec2 TransmittanceLutSize=vec2(256.,64.);const vec2 TransmittanceLutDomainInUVSpace=(TransmittanceLutSize-vec2(1.))/TransmittanceLutSize;const vec2 TransmittanceLutHalfTexelSize=vec2(0.5)/TransmittanceLutSize;const float TransmittanceHorizonRange=2.*TransmittanceLutHalfTexelSize.x;const float TransmittanceMaxUnoccludedU=1.-0.5*TransmittanceHorizonRange;const float TransmittanceMinOccludedU=1.+0.5*TransmittanceHorizonRange;vec2 uvToUnit(vec2 uv,vec2 domainInUVSpace,vec2 halfTexelSize) {return (uv-halfTexelSize)/domainInUVSpace;}
vec2 unitToUV(vec2 unit,vec2 domainInUVSpace,vec2 halfTexelSize) {return unit*domainInUVSpace+halfTexelSize;}
float sphereIntersectNearest(vec3 rayOrigin,vec3 rayDirection,float sphereRadius) {vec2 result=sphereIntersectFromOrigin(rayOrigin,rayDirection,sphereRadius);float c=dot(rayOrigin,rayOrigin)-sphereRadius*sphereRadius;return c>=0.0 ?
result.y :
result.x;}
void moveToTopAtmosphere(
vec3 cameraPosition,
float positionRadius,
vec3 positionGeocentricNormal,
vec3 rayDirection,
out bool intersectsAtmosphere,
out vec3 cameraPositionClampedToTopOfAtmosphere) {intersectsAtmosphere=true;cameraPositionClampedToTopOfAtmosphere=cameraPosition;if (positionRadius>atmosphereRadius) {float tTop=sphereIntersectNearest(cameraPosition,rayDirection,atmosphereRadius);if (tTop>=0.0) {vec3 upOffset=-planetRadiusOffset*positionGeocentricNormal;cameraPositionClampedToTopOfAtmosphere=cameraPosition+rayDirection*tTop+upOffset;} else {intersectsAtmosphere=false;}}}
void getSkyViewUVFromParameters(
bool intersectsGround,
float cosHorizonAngleFromZenith,
float cosAngleBetweenViewAndZenith,
float cosAngleBetweenViewAndLightOnPlane,
out vec2 uv)
{vec2 unit=vec2(0.0);if (intersectsGround) {float coord=(cosAngleBetweenViewAndZenith+1.0)/(cosHorizonAngleFromZenith+1.0);coord=sqrtClamped(coord); 
unit.y=0.5*coord; } else {float coord=(cosAngleBetweenViewAndZenith-cosHorizonAngleFromZenith)/(1.0-cosHorizonAngleFromZenith);coord=sqrtClamped(coord); 
unit.y=0.5*coord+0.5; }
{float coord=0.5-0.5*cosAngleBetweenViewAndLightOnPlane;unit.x=coord;}
uv=unitToUV(unit,SkyViewLutDomainInUVSpace,SkyViewLutHalfTexelSize);}
vec4 sampleSkyViewLut(
sampler2D skyViewLut,
float positionRadius,
vec3 geocentricNormal,
vec3 rayDirection,
vec3 directionToLight,
float cosHorizonAngleFromZenith,
out float cosAngleBetweenViewAndZenith,
out bool isRayIntersectingGround) {cosAngleBetweenViewAndZenith=dot(rayDirection,geocentricNormal);if (positionRadius>atmosphereRadius) {float sinAngleBetweenViewAndNadir=sqrtClamped(1.-cosAngleBetweenViewAndZenith*cosAngleBetweenViewAndZenith);if (sinAngleBetweenViewAndNadir>sinCameraAtmosphereHorizonAngleFromNadir) {isRayIntersectingGround=false;return vec4(0.);}}
vec3 sideVector=normalize(cross(geocentricNormal,rayDirection));vec3 forwardVector=normalize(cross(sideVector,geocentricNormal));vec2 lightOnPlane=normalize(vec2(dot(directionToLight,forwardVector),dot(directionToLight,sideVector)));float cosAngleBetweenViewAndLightOnPlane=lightOnPlane.x;float rayIntersectionScale=mix(0.95,1.,saturate((positionRadius-planetRadius)/atmosphereThickness));isRayIntersectingGround =
positionRadius>planetRadius &&
(rayIntersectionScale*cosAngleBetweenViewAndZenith)<=cosHorizonAngleFromZenith;vec2 uv;getSkyViewUVFromParameters(
isRayIntersectingGround,
cosHorizonAngleFromZenith,
cosAngleBetweenViewAndZenith,
cosAngleBetweenViewAndLightOnPlane,
uv);return textureLod(skyViewLut,uv,0.);}
float computeRayleighPhase(float onePlusCosThetaSq) {return 0.0596831037*onePlusCosThetaSq;}
float computeMiePhaseCornetteShanks(float cosTheta,float onePlusCosThetaSq) {const float g=0.8;const float gSquared=g*g;const float oneMinusGSquared=1.-gSquared;const float onePlusGSquared=1.+gSquared;const float twoPlusGSquared=2.+gSquared;const float twoG=2.*g;const float threeOverEightPi=3./(8.*PI);return threeOverEightPi*oneMinusGSquared*onePlusCosThetaSq/(twoPlusGSquared*pow(onePlusGSquared-twoG*cosTheta,1.5));}
float computeOzoneDensity(float normalizedViewHeight) {const float MinOzoneDensity=0.135;const float OneMinusMinOzoneDensity=1.-MinOzoneDensity;const float OzoneStartHeight=.15; 
const float PeakOzoneHeight=.25;const float MaxOzoneHeight=0.6;const float InverseRampupDistance=1./(PeakOzoneHeight-OzoneStartHeight);const float InverseRampdownDistance=1./(MaxOzoneHeight-PeakOzoneHeight);float lowerAtmosphereDensity=MinOzoneDensity+OneMinusMinOzoneDensity*max(0.,normalizedViewHeight-OzoneStartHeight)*InverseRampupDistance;float sqrtUpperAtmosphereDensity=max(0.,1.-(normalizedViewHeight-PeakOzoneHeight)*InverseRampdownDistance);float upperAtmosphereDensity=sqrtUpperAtmosphereDensity*sqrtUpperAtmosphereDensity;float densityOzone=normalizedViewHeight<PeakOzoneHeight ? lowerAtmosphereDensity : upperAtmosphereDensity;return densityOzone;}
void sampleMediumRGB(
float viewHeight,
out vec3 scatteringRayleigh,
out vec3 scatteringMie,
out vec3 extinction,
out vec3 scattering) {float normalizedViewHeight=saturate(viewHeight*inverseAtmosphereThickness);float densityMie=exp(-83.333*normalizedViewHeight);float densityRayleigh=exp(-12.5*normalizedViewHeight);float densityOzone=computeOzoneDensity(normalizedViewHeight);scatteringRayleigh=densityRayleigh*peakRayleighScattering;scatteringMie=densityMie*peakMieScattering;scattering=scatteringMie+scatteringRayleigh;vec3 extinctionRayleigh=scatteringRayleigh;vec3 extinctionMie=densityMie*peakMieExtinction;vec3 extinctionOzone=densityOzone*peakOzoneAbsorption;extinction=extinctionRayleigh+extinctionMie+extinctionOzone;}
vec3 computeTransmittance(vec3 rayOriginGlobal,vec3 rayDirection,float tMax,float sampleCount) {vec3 opticalDepth=vec3(0.);float t=0.;float sampleSegmentWeight=tMax/sampleCount;const float sampleSegmentT=0.3;for (float s=0.; s<sampleCount; s+=1.) {float newT=sampleSegmentWeight*(s+sampleSegmentT);float dt=newT-t;t=newT;vec3 scatteringRayleigh,scatteringMie,extinction,scattering;vec3 samplePositionGlobal=rayOriginGlobal+t*rayDirection;sampleMediumRGB(length(samplePositionGlobal)-planetRadius,scatteringRayleigh,scatteringMie,extinction,scattering);opticalDepth+=extinction*dt;}
return exp(-opticalDepth);}
vec2 getTransmittanceUV(float radius,float cosAngleLightToZenith,out float distanceToHorizon) {float radiusSquared=radius*radius;distanceToHorizon=sqrtClamped(radiusSquared-planetRadiusSquared);float cosAngleLightToZenithSquared=cosAngleLightToZenith*cosAngleLightToZenith;float discriminant=radiusSquared*(cosAngleLightToZenithSquared-1.)+atmosphereRadiusSquared;float distanceToAtmosphereEdge=max(0.,-radius*cosAngleLightToZenith+sqrtClamped(discriminant));float minDistanceToAtmosphereEdge=max(0.,atmosphereRadius-radius);float maxDistanceToAtmosphereEdge=distanceToHorizon+horizonDistanceToAtmosphereEdge;float cosAngleLightToZenithCoordinate=(distanceToAtmosphereEdge-minDistanceToAtmosphereEdge)/max(0.000001,maxDistanceToAtmosphereEdge-minDistanceToAtmosphereEdge);float distanceToHorizonCoordinate=distanceToHorizon/max(0.000001,horizonDistanceToAtmosphereEdge);vec2 unit=vec2(cosAngleLightToZenithCoordinate,distanceToHorizonCoordinate);return unit*TransmittanceLutDomainInUVSpace+TransmittanceLutHalfTexelSize; }
vec4 sampleTransmittanceLut(sampler2D transmittanceLut,float positionRadius,float cosAngleLightToZenith) {float distanceToHorizon;vec2 uv=getTransmittanceUV(positionRadius,cosAngleLightToZenith,distanceToHorizon);float weight=smoothstep(TransmittanceMinOccludedU,TransmittanceMaxUnoccludedU,uv.x);return weight*textureLod(transmittanceLut,uv,0.);}
vec3 sampleMultiScatteringLut(sampler2D multiScatteringLut,float radius,float cosAngleLightToZenith) {vec2 unit=vec2(0.5+0.5*cosAngleLightToZenith,(radius-planetRadius)/atmosphereThickness);vec2 uv=unitToUV(unit,MultiScatteringLutDomainInUVSpace,MultiScatteringLutHalfTexelSize);vec3 multiScattering=textureLod(multiScatteringLut,uv,0.).rgb;return max(minMultiScattering,multiScattering);}
const float uniformPhase=RECIPROCAL_PI4;void integrateScatteredRadiance(
bool isAerialPerspectiveLut,
float lightIntensity,
sampler2D transmittanceLut,
#ifndef COMPUTE_MULTI_SCATTERING
sampler2D multiScatteringLut,
float multiScatteringIntensity,
#endif
vec3 rayOriginGlobal,
vec3 rayDirection,
vec3 directionToLight,
float tMaxMax,
float sampleCount,
float distanceToSurface,
out vec3 radiance,
out vec3 transmittance
#if COMPUTE_MULTI_SCATTERING
,out vec3 multiScattering
#endif
) {radiance=vec3(0.);transmittance=vec3(1.);
#if COMPUTE_MULTI_SCATTERING
multiScattering=vec3(0.);
#endif
float tBottom=sphereIntersectNearest(rayOriginGlobal,rayDirection,planetRadius);float tTop=sphereIntersectNearest(rayOriginGlobal,rayDirection,atmosphereRadius);float tMax=0.;if (tBottom<0.) {if (tTop<0.) {return;} else {tMax=tTop;}} else {if (tTop>0.) {if (isAerialPerspectiveLut) {tMax=tTop;} else {tMax=min(tBottom,tTop);}}}
if (distanceToSurface>0. && distanceToSurface<tMax) {tMax=distanceToSurface;}
tMax=min(tMax,tMaxMax);
#ifndef COMPUTE_MULTI_SCATTERING
float cosTheta=dot(rayDirection,directionToLight);float onePlusCosThetaSq=1.+cosTheta*cosTheta;float rayleighPhase=computeRayleighPhase(onePlusCosThetaSq);float miePhase=computeMiePhaseCornetteShanks(cosTheta,onePlusCosThetaSq);
#endif
float transmittanceScale=isAerialPerspectiveLut ? aerialPerspectiveTransmittanceScale : 1.;float t=0.;float sampleSegmentWeight=tMax/sampleCount;const float sampleSegmentT=0.3;for (float s=0.; s<sampleCount; s+=1.) {float newT=sampleSegmentWeight*(s+sampleSegmentT);float dt=newT-t;t=newT;vec3 samplePositionGlobal=rayOriginGlobal+t*rayDirection;float sampleRadiusGlobal=length(samplePositionGlobal);vec3 sampleGeocentricNormal=samplePositionGlobal/sampleRadiusGlobal;float sampleCosAngleLightToZenith=dot(directionToLight,sampleGeocentricNormal);vec3 scatteringRayleigh,scatteringMie,extinction,scattering;sampleMediumRGB(sampleRadiusGlobal-planetRadius,scatteringRayleigh,scatteringMie,extinction,scattering);vec3 transmittanceToLight=sampleTransmittanceLut(transmittanceLut,sampleRadiusGlobal,sampleCosAngleLightToZenith).rgb;
#if COMPUTE_MULTI_SCATTERING
vec3 phaseTimesScattering=uniformPhase*scattering;vec3 S=transmittanceToLight*phaseTimesScattering;
#else
vec3 phaseTimesScattering=scatteringMie*miePhase+scatteringRayleigh*rayleighPhase;vec3 multiScatteredRadiance=sampleMultiScatteringLut(multiScatteringLut,sampleRadiusGlobal,sampleCosAngleLightToZenith);vec3 S=transmittanceScale*transmittanceToLight*phaseTimesScattering+multiScatteringIntensity*multiScatteredRadiance*scattering;
#endif
vec3 sampleOpticalDepth=extinction*dt;vec3 sampleTransmittance=exp(-sampleOpticalDepth);vec3 clampedExtinction=max(vec3(0.0000001),extinction);vec3 SInt=(S-S*sampleTransmittance)/clampedExtinction;radiance+=transmittance*SInt;
#if COMPUTE_MULTI_SCATTERING
vec3 MSInt=(scattering-scattering*sampleTransmittance)/clampedExtinction;multiScattering+=transmittance*MSInt;
#endif
transmittance*=sampleTransmittance;}
#if USE_GROUND_ALBEDO
if (tMax==tBottom && tBottom>0.) {vec3 planetPos=rayOriginGlobal+tBottom*rayDirection;float planetPosRadius=length(planetPos);vec3 planetPosGeocentricNormal=planetPos/planetPosRadius;float nDotL=dot(directionToLight,planetPosGeocentricNormal);vec3 lightTransmittance=sampleTransmittanceLut(transmittanceLut,planetPosRadius,nDotL).rgb;const float diffuseBrdf=RECIPROCAL_PI;radiance+=lightTransmittance*transmittance*groundAlbedo*(nDotL*diffuseBrdf);}
#endif
radiance*=lightIntensity;}
float layerIdxToAerialPerspectiveLayer(float layerIdx) {float layer=(layerIdx+1.)/NumAerialPerspectiveLutLayers;layer*=layer; 
layer*=NumAerialPerspectiveLutLayers;return layer;}
float toAerialPerspectiveDepth(float layer) {return layer*AerialPerspectiveLutKMPerSlice;}
float toAerialPerspectiveLayer(float distance,float aerialPerspectiveLutDistancePerSlice) {return distance/aerialPerspectiveLutDistancePerSlice;}
vec4 applyAerialPerspectiveSaturation(vec4 aerialPerspective) {float previousRadiance=getLuminance(aerialPerspective.rgb);aerialPerspective.rgb=mix(vec3(previousRadiance),aerialPerspective.rgb,aerialPerspectiveSaturation);return aerialPerspective;}
vec4 applyAerialPerspectiveIntensity(vec4 aerialPerspective) {
#if APPLY_AERIAL_PERSPECTIVE_INTENSITY
if (aerialPerspectiveIntensity==0.) {aerialPerspective=vec4(0.);} else {float previousAlpha=aerialPerspective.a;aerialPerspective/=max(0.00001,previousAlpha);aerialPerspective*=pow(previousAlpha,1./aerialPerspectiveIntensity);}
#endif
return aerialPerspective;}
vec4 applyAerialPerspectiveRadianceBias(vec4 aerialPerspective) {
#if APPLY_AERIAL_PERSPECTIVE_RADIANCE_BIAS
float originalRadiance=dot(aerialPerspective.rgb,LuminanceEncodeApprox);float targetRadiance=originalRadiance+aerialPerspectiveRadianceBias;if (originalRadiance>0.) {aerialPerspective*=max(0.,targetRadiance/originalRadiance);} else {aerialPerspective=max(vec4(0.),vec4(vec3(aerialPerspectiveRadianceBias),aerialPerspectiveRadianceBias));}
aerialPerspective.a=min(aerialPerspective.a,1.);
#endif
return aerialPerspective;}
bool sampleAerialPerspectiveLut(
vec2 screenUV,
bool clampToLutRange,
float distanceFromCamera,
float numAerialPerspectiveLutLayers,
float aerialPerspectiveLutKMPerSlice,
float aerialPerspectiveLutRangeKM,
out vec4 aerialPerspective) {aerialPerspective=vec4(0.);
#if USE_AERIAL_PERSPECTIVE_LUT
if (distanceFromCamera>0. &&
(clampToLutRange || distanceFromCamera<aerialPerspectiveLutRangeKM) &&
clampedCameraRadius<=atmosphereRadius) {float layer=toAerialPerspectiveLayer(distanceFromCamera,aerialPerspectiveLutKMPerSlice);float normalizedLayer=sqrt(layer/numAerialPerspectiveLutLayers); 
layer=min(normalizedLayer*numAerialPerspectiveLutLayers,numAerialPerspectiveLutLayers);float weight=min(layer,1.);float layerIdx=max(0.,layer-1.);float floorLayerIdx=floor(layerIdx);vec4 aerialPerspectiveLayer0=textureLod(aerialPerspectiveLut,vec3(screenUV,floorLayerIdx),0.);vec4 aerialPerspectiveLayer1=textureLod(aerialPerspectiveLut,vec3(screenUV,floorLayerIdx+1.),0.);aerialPerspective=mix(aerialPerspectiveLayer0,aerialPerspectiveLayer1,layerIdx-floorLayerIdx);aerialPerspective.rgb*=atmosphereExposure;aerialPerspective=applyAerialPerspectiveSaturation(aerialPerspective);aerialPerspective=weight*applyAerialPerspectiveIntensity(aerialPerspective);aerialPerspective=applyAerialPerspectiveRadianceBias(aerialPerspective);return true;}
#endif
return false;}
#if RENDER_TRANSMITTANCE
void getTransmittanceParameters(vec2 uv,out float radius,out float cosAngleLightToZenith,out float distanceToAtmosphereEdge) {vec2 unit=uvToUnit(uv,TransmittanceLutDomainInUVSpace,TransmittanceLutHalfTexelSize);float distanceToHorizon=unit.y*horizonDistanceToAtmosphereEdge;float distanceToHorizonSquared=distanceToHorizon*distanceToHorizon;radius=sqrtClamped(distanceToHorizonSquared+planetRadiusSquared);float minDistanceToAtmosphereEdge=atmosphereRadius-radius;float maxDistanceToAtmosphereEdge=distanceToHorizon+horizonDistanceToAtmosphereEdge;distanceToAtmosphereEdge=minDistanceToAtmosphereEdge+unit.x*(maxDistanceToAtmosphereEdge-minDistanceToAtmosphereEdge);float distanceToAtmosphereEdgeSquared=distanceToAtmosphereEdge*distanceToAtmosphereEdge;cosAngleLightToZenith =
distanceToAtmosphereEdge<=0. ?
1. :
(horizonDistanceToAtmosphereEdgeSquared-distanceToAtmosphereEdgeSquared-distanceToHorizonSquared)/(2.*radius*distanceToAtmosphereEdge);cosAngleLightToZenith=clamp(cosAngleLightToZenith,-1.,1.);}
vec4 renderTransmittance(vec2 uv) {float radius,cosAngleLightToZenith,distanceToAtmosphereEdgeAlongAngle;getTransmittanceParameters(uv,radius,cosAngleLightToZenith,distanceToAtmosphereEdgeAlongAngle);float sinAngleLightToZenith=sqrtClamped(1.-cosAngleLightToZenith*cosAngleLightToZenith);vec3 directionToLight=normalize(vec3(0.,cosAngleLightToZenith,sinAngleLightToZenith));vec3 transmittance=computeTransmittance(vec3(0.,radius,0.),directionToLight,distanceToAtmosphereEdgeAlongAngle,TransmittanceSampleCount);return vec4(transmittance,avg(transmittance));}
#endif
#if RENDER_MULTI_SCATTERING
vec3 getSphereSample(float azimuth,float inclination,out float sinInclination) {sinInclination=sin(inclination);return vec3(sinInclination*sin(azimuth),cos(inclination),sinInclination*cos(azimuth));}
const float MultiScatteringInclinationSampleCount=8.;const float MultiScatteringAzimuthSampleCount=2.*MultiScatteringInclinationSampleCount;const float MultiScatteringLutSampleCount=64.;const float MultiScatteringAzimuthIterationAngle=TWO_PI/MultiScatteringAzimuthSampleCount;const float MultiScatteringInclinationIterationAngle=PI/MultiScatteringInclinationSampleCount;const float MultiScatteringAngleStepProduct=MultiScatteringAzimuthIterationAngle*MultiScatteringInclinationIterationAngle;vec4 renderMultiScattering(vec2 uv,sampler2D transmittanceLut) {vec2 unit=uvToUnit(uv,MultiScatteringLutDomainInUVSpace,MultiScatteringLutHalfTexelSize);float cosAngleLightToZenith=2.*unit.x-1.;float sinAngleLightToZenith=sqrtClamped(1.-cosAngleLightToZenith*cosAngleLightToZenith);vec3 directionToLight=normalize(vec3(0.,cosAngleLightToZenith,sinAngleLightToZenith));float rayOriginRadius=planetRadius+max(unit.y,0.001)*atmosphereThickness;vec3 rayOrigin=vec3(0.,rayOriginRadius,0.);vec3 inscattered=vec3(0.);vec3 multiScatteringTotal=vec3(0.);for (float i=0.5; i<MultiScatteringAzimuthSampleCount; ++i) {float azimuth=MultiScatteringAzimuthIterationAngle*i;for (float j=0.5; j<MultiScatteringInclinationSampleCount; ++j) {float inclination=MultiScatteringInclinationIterationAngle*j;float sinInclination;vec3 rayDirection=getSphereSample(azimuth,inclination,sinInclination);vec3 radiance;vec3 transmittance;vec3 multiScattering;integrateScatteredRadiance(
false,
1.,
transmittanceLut,
rayOrigin,
rayDirection,
directionToLight,
100000000.,
MultiScatteringLutSampleCount,
-1.,
radiance,
transmittance,
multiScattering);float weight=RECIPROCAL_PI4*abs(sinInclination)*MultiScatteringAngleStepProduct;multiScatteringTotal+=multiScattering*weight;inscattered+=radiance*weight;}}
vec3 multiScattering=inscattered/max(vec3(0.000001),vec3(1.)-multiScatteringTotal);return vec4(multiScattering,1.);}
#endif
float computeCosHorizonAngleFromZenith(float radius) {float sinAngleBetweenHorizonAndNadir=min(1.,planetRadius/radius);float cosHorizonAngleFromNadir=sqrt(1.-sinAngleBetweenHorizonAndNadir*sinAngleBetweenHorizonAndNadir);float cosHorizonAngleFromZenith=-cosHorizonAngleFromNadir;return cosHorizonAngleFromZenith;}
#if RENDER_SKY_VIEW
void getSkyViewParametersFromUV(
float radius,
vec2 uv,
out float cosAngleBetweenViewAndZenith,
out float cosAngleBetweenViewAndLightOnPlane) {vec2 unit=uvToUnit(uv,SkyViewLutDomainInUVSpace,SkyViewLutHalfTexelSize);float cosHorizonAngleFromZenith=computeCosHorizonAngleFromZenith(radius);if (unit.y<0.5) {float coord=2.*unit.y; 
coord*=coord; 
cosAngleBetweenViewAndZenith=mix(-1.,cosHorizonAngleFromZenith,coord); } else {float coord=2.*unit.y-1.; 
coord*=coord; 
cosAngleBetweenViewAndZenith=mix(cosHorizonAngleFromZenith,1.,coord); }
{float coord=unit.x;cosAngleBetweenViewAndLightOnPlane=1.-2.*coord;}}
vec4 renderSkyView(vec2 uv,sampler2D transmittanceLut,sampler2D multiScatteringLut) {float cosAngleBetweenViewAndZenith;float cosAngleBetweenViewAndLightOnPlane;getSkyViewParametersFromUV(clampedCameraRadius,uv,cosAngleBetweenViewAndZenith,cosAngleBetweenViewAndLightOnPlane);float sinAngleBetweenViewAndZenith=sqrtClamped(1.-cosAngleBetweenViewAndZenith*cosAngleBetweenViewAndZenith);float sinAngleBetweenViewAndLightOnPlane=sqrtClamped(1.-cosAngleBetweenViewAndLightOnPlane*cosAngleBetweenViewAndLightOnPlane);vec3 rayDirection =
vec3(
sinAngleBetweenViewAndZenith*cosAngleBetweenViewAndLightOnPlane,
cosAngleBetweenViewAndZenith,
sinAngleBetweenViewAndZenith*sinAngleBetweenViewAndLightOnPlane);bool intersectsAtmosphere=false;vec3 cameraPositionGlobalClampedToTopOfAtmosphere=vec3(0.);moveToTopAtmosphere(
vec3(0.,clampedCameraRadius,0.),
clampedCameraRadius,
vec3(0.,1.,0.),
rayDirection,
intersectsAtmosphere,
cameraPositionGlobalClampedToTopOfAtmosphere);if (!intersectsAtmosphere) {return vec4(0.);}
vec3 transmittance;vec3 radiance;integrateScatteredRadiance(
false,
atmosphereExposure*lightIntensity,
transmittanceLut,
multiScatteringLut,
multiScatteringIntensity,
cameraPositionGlobalClampedToTopOfAtmosphere,
rayDirection,
directionToLightRelativeToCameraGeocentricNormal,
100000000.,
SkyViewLutSampleCount,
-1.,
radiance,
transmittance);float transparency=1.-avg(transmittance);return vec4(radiance,transparency);}
#endif
#if RENDER_CAMERA_VOLUME
vec4 renderCameraVolume(
vec3 positionOnNearPlane,
float layerIdx,
sampler2D transmittanceLut,
sampler2D multiScatteringLut) {vec4 result=vec4(0.);vec3 rayDirection=normalize(positionOnNearPlane);float layer=layerIdxToAerialPerspectiveLayer(layerIdx);float tMax=toAerialPerspectiveDepth(layer);float tMaxMax=tMax;vec3 cameraPositionGlobalClampedToTopOfAtmosphere=clampedCameraPositionGlobal;if (clampedCameraRadius>=atmosphereRadius) {bool intersectsAtmosphere=false;moveToTopAtmosphere(
clampedCameraPositionGlobal,
clampedCameraRadius,
cameraGeocentricNormal,
rayDirection,
intersectsAtmosphere,
cameraPositionGlobalClampedToTopOfAtmosphere);if (!intersectsAtmosphere) {return result;}
float distanceToAtmosphere=distance(clampedCameraPositionGlobal,cameraPositionGlobalClampedToTopOfAtmosphere);if (tMaxMax<distanceToAtmosphere) {return result;}
tMaxMax=max(0.,tMaxMax-distanceToAtmosphere);}
float sampleCount=min(SkyViewLutSampleCount,2.*layer+2.);vec3 transmittance;vec3 radiance;integrateScatteredRadiance(
true,
lightIntensity,
transmittanceLut,
multiScatteringLut,
multiScatteringIntensity,
cameraPositionGlobalClampedToTopOfAtmosphere,
rayDirection,
directionToLight,
tMaxMax,
sampleCount,
-1.,
radiance,
transmittance);float transparency=1.-avg(transmittance);result=vec4(radiance,transparency);return result;}
#endif
`;h.IncludesShadersStore[X]||(h.IncludesShadersStore[X]=He);const Q="diffuseSkyIrradiancePixelShader",Ve=`precision highp float;const float DiffuseSkyIrradianceLutSampleCount=32.0;
#include<__decl__atmosphereFragment>
#include<helperFunctions>
#include<depthFunctions>
#include<atmosphereFunctions>
uniform sampler2D transmittanceLut;uniform sampler2D multiScatteringLut;vec3 integrateForIrradiance(vec3 directionToLight,vec3 rayDirection,vec3 rayOrigin) {vec3 radiance;vec3 transmittance;integrateScatteredRadiance(
false,
1.,
transmittanceLut,
multiScatteringLut,
multiScatteringIntensity,
rayOrigin,
rayDirection.xzy,
directionToLight.xzy,
100000000.,
DiffuseSkyIrradianceLutSampleCount,
-1.,
radiance,
transmittance);return radiance;}
#include<importanceSampling>
#include<pbrBRDFFunctions>
#include<hdrFilteringFunctions>
varying vec2 uv;void main() {vec2 unit=uvToUnit(uv,DiffuseSkyIrradianceLutDomainInUVSpace,DiffuseSkyIrradianceLutHalfTexelSize);float cosLightInclination=2.*unit.x-1.;float sinLightInclination=sqrtClamped(1.-cosLightInclination*cosLightInclination);vec3 directionToLight=normalize(vec3(0.,cosLightInclination,sinLightInclination));float radius=max(planetRadiusWithOffset,unit.y*atmosphereThickness+planetRadius);vec3 swappedDirectionToLight=vec3(directionToLight.x,directionToLight.z,directionToLight.y); 
vec3 irradiance =
PI *
irradiance(
swappedDirectionToLight,
vec2(radius,0.),
1.,
vec3(1.),
vec3(1.));float averageIrradiance=getLuminance(irradiance);vec3 newIrradiance=mix(irradiance,vec3(averageIrradiance),diffuseSkyIrradianceDesaturationFactor);float newIrradianceScale=getLuminance(newIrradiance);float rescaling=averageIrradiance/max(0.000001,newIrradianceScale);irradiance=newIrradiance*rescaling;gl_FragColor=vec4(irradiance,1.);}`;h.ShadersStore[Q]||(h.ShadersStore[Q]=Ve);const ee="fullscreenTriangleVertexShader",Ue=`precision highp float;
#include<__decl__atmosphereFragment>
#if POSITION_VEC2
attribute vec2 position;
#else
attribute vec3 position;
#endif
uniform float depth;varying vec2 uv;
#if COMPUTE_WORLD_RAY
varying vec3 positionOnNearPlane;
#endif
#if COMPUTE_WORLD_RAY
const float nearPlaneNDC=-1.;
#endif
void main() {gl_Position=vec4(position.xy,depth,1.);uv=0.5*position.xy+vec2(0.5);
#if COMPUTE_WORLD_RAY
positionOnNearPlane=(inverseViewProjectionWithoutTranslation*vec4(position.xy,nearPlaneNDC,1.)).xyz;
#endif
}`;h.ShadersStore[ee]||(h.ShadersStore[ee]=Ue);const te="transmittancePixelShader",Ge=`#define RENDER_TRANSMITTANCE 1
precision highp float;
#include<__decl__atmosphereFragment>
#include<helperFunctions>
#include<atmosphereFunctions>
varying vec2 uv;void main() {gl_FragColor=renderTransmittance(uv);}`;h.ShadersStore[te]||(h.ShadersStore[te]=Ge);const ie="compositeAerialPerspectivePixelShader",ke=`precision highp float;precision highp sampler2D;precision highp sampler2DArray;
#include<__decl__atmosphereFragment>
#if USE_AERIAL_PERSPECTIVE_LUT
uniform sampler2DArray aerialPerspectiveLut;
#endif
#include<helperFunctions>
#include<depthFunctions>
#include<atmosphereFunctions>
uniform sampler2D depthTexture;uniform sampler2D transmittanceLut;uniform sampler2D multiScatteringLut;varying vec2 uv;varying vec3 positionOnNearPlane;void main() {gl_FragColor=vec4(0.);float depth=textureLod(depthTexture,uv,0.).r;if (depth>=1.) {discard;}
vec3 rayDirection=normalize(positionOnNearPlane);float distanceFromCamera =
reconstructDistanceFromCamera(
depth,
rayDirection,
cameraForward,
cameraNearPlane);float distanceToSurface=distanceFromCamera/1000.;vec4 aerialPerspective=vec4(0.);if (sampleAerialPerspectiveLut(
uv,
false,
distanceToSurface,
NumAerialPerspectiveLutLayers,
AerialPerspectiveLutKMPerSlice,
AerialPerspectiveLutRangeKM,
aerialPerspective)) {
#ifndef APPLY_TRANSMITTANCE_BLENDING
aerialPerspective.a=0.;
#endif
gl_FragColor=aerialPerspective;} else {bool intersectsAtmosphere=false;vec3 cameraPositionGlobalClampedToTopOfAtmosphere=vec3(0.);moveToTopAtmosphere(
clampedCameraPositionGlobal,
clampedCameraRadius,
cameraGeocentricNormal,
rayDirection,
intersectsAtmosphere,
cameraPositionGlobalClampedToTopOfAtmosphere);if (!intersectsAtmosphere) {gl_FragColor=vec4(0.);return;}
vec3 transmittance;vec3 radiance;bool isAerialPerspectiveLut=clampedCameraRadius<atmosphereRadius;integrateScatteredRadiance(
isAerialPerspectiveLut,
atmosphereExposure*lightIntensity,
transmittanceLut,
multiScatteringLut,
multiScatteringIntensity,
cameraPositionGlobalClampedToTopOfAtmosphere,
rayDirection,
directionToLight,
100000000.,
SkyViewLutSampleCount,
distanceToSurface,
radiance,
transmittance);float transparency=1.-avg(transmittance);gl_FragColor =
applyAerialPerspectiveRadianceBias(
applyAerialPerspectiveIntensity(
applyAerialPerspectiveSaturation(vec4(radiance,transparency))));
#ifndef APPLY_TRANSMITTANCE_BLENDING
gl_FragColor.a=0.;
#endif
}
#if OUTPUT_TO_SRGB
gl_FragColor=toGammaSpace(gl_FragColor);
#endif
}`;h.ShadersStore[ie]||(h.ShadersStore[ie]=ke);const ae="compositeSkyPixelShader",Be=`precision highp float;precision highp sampler2D;
#include<__decl__atmosphereFragment>
#include<helperFunctions>
#include<depthFunctions>
#include<atmosphereFunctions>
varying vec2 uv;varying vec3 positionOnNearPlane;
#if USE_SKY_VIEW_LUT
uniform sampler2D skyViewLut;
#else
uniform sampler2D transmittanceLut;uniform sampler2D multiScatteringLut;
#endif
void main() {gl_FragColor=vec4(0.);vec3 rayDirection=normalize(positionOnNearPlane);
#if USE_SKY_VIEW_LUT
float cosAngleBetweenViewAndZenith;bool isRayIntersectingGround;vec4 skyColor =
sampleSkyViewLut(
skyViewLut,
clampedCameraRadius,
cameraGeocentricNormal,
rayDirection,
directionToLight,
cosCameraHorizonAngleFromZenith,
cosAngleBetweenViewAndZenith,
isRayIntersectingGround);
#ifndef APPLY_TRANSMITTANCE_BLENDING
skyColor.a=0.;
#endif
gl_FragColor=skyColor;gl_FragColor.a=isRayIntersectingGround ? 1. : gl_FragColor.a;
#else
bool intersectsAtmosphere=false;vec3 cameraPositionGlobalClampedToTopOfAtmosphere=vec3(0.);moveToTopAtmosphere(
clampedCameraPositionGlobal,
clampedCameraRadius,
cameraGeocentricNormal,
rayDirection,
intersectsAtmosphere,
cameraPositionGlobalClampedToTopOfAtmosphere);if (!intersectsAtmosphere) {return;}
vec3 transmittance;vec3 radiance;integrateScatteredRadiance(
false,
atmosphereExposure*lightIntensity,
transmittanceLut,
multiScatteringLut,
multiScatteringIntensity,
cameraPositionGlobalClampedToTopOfAtmosphere,
rayDirection,
directionToLight,
100000000.,
SkyViewLutSampleCount,
-1.,
radiance,
transmittance);
#if APPLY_TRANSMITTANCE_BLENDING
float transparency=1.-avg(transmittance);
#else
float transparency=0.;
#endif
gl_FragColor=vec4(radiance,transparency);
#endif
#if OUTPUT_TO_SRGB
gl_FragColor=toGammaSpace(gl_FragColor);
#endif
}`;h.ShadersStore[ae]||(h.ShadersStore[ae]=Be);const re="compositeGlobeAtmospherePixelShader",$e=`precision highp float;precision highp sampler2D;
#include<__decl__atmosphereFragment>
#include<helperFunctions>
#include<depthFunctions>
#include<atmosphereFunctions>
varying vec2 uv;varying vec3 positionOnNearPlane;
#if HAS_DEPTH_TEXTURE
uniform sampler2D depthTexture;
#endif
#if USE_SKY_VIEW_LUT
uniform sampler2D skyViewLut;
#else
uniform sampler2D transmittanceLut;uniform sampler2D multiScatteringLut;
#endif
void main() {gl_FragColor=vec4(0.);
#if HAS_DEPTH_TEXTURE
float depth=textureLod(depthTexture,uv,0.).r;
#endif
vec3 rayDirection=normalize(positionOnNearPlane);
#if USE_SKY_VIEW_LUT
float cosAngleBetweenViewAndZenith;bool isRayIntersectingGround;vec4 skyColor =
sampleSkyViewLut(
skyViewLut,
clampedCameraRadius,
cameraGeocentricNormal,
rayDirection,
directionToLight,
cosCameraHorizonAngleFromZenith,
cosAngleBetweenViewAndZenith,
isRayIntersectingGround);gl_FragColor=skyColor;if (isRayIntersectingGround) {gl_FragColor =
applyAerialPerspectiveRadianceBias(
applyAerialPerspectiveIntensity(
applyAerialPerspectiveSaturation(gl_FragColor)));
#if HAS_DEPTH_TEXTURE
gl_FragColor.a=depth>=1. ? 1. : gl_FragColor.a;
#endif
}
#else
bool intersectsAtmosphere=false;vec3 cameraPositionGlobalClampedToTopOfAtmosphere=vec3(0.);moveToTopAtmosphere(
clampedCameraPositionGlobal,
clampedCameraRadius,
cameraGeocentricNormal,
rayDirection,
intersectsAtmosphere,
cameraPositionGlobalClampedToTopOfAtmosphere);if (!intersectsAtmosphere) {return;}
#if HAS_DEPTH_TEXTURE
float distanceFromCamera =
reconstructDistanceFromCamera(
depth,
rayDirection,
cameraForward,
cameraNearPlane);float distanceToSurface=distanceFromCamera/1000.;
#else
float distanceToSurface=0.;
#endif
vec3 transmittance;vec3 radiance;integrateScatteredRadiance(
false,
atmosphereExposure*lightIntensity,
transmittanceLut,
multiScatteringLut,
multiScatteringIntensity,
cameraPositionGlobalClampedToTopOfAtmosphere,
rayDirection,
directionToLight,
100000000.,
SkyViewLutSampleCount,
distanceToSurface,
radiance,
transmittance);float transparency=1.-avg(transmittance);gl_FragColor=vec4(radiance,transparency);if (distanceToSurface>0.) {gl_FragColor =
applyAerialPerspectiveRadianceBias(
applyAerialPerspectiveIntensity(
applyAerialPerspectiveSaturation(gl_FragColor)));
#if HAS_DEPTH_TEXTURE
gl_FragColor.a=depth>=1. ? 1. : gl_FragColor.a;
#endif
}
#endif
#if OUTPUT_TO_SRGB
gl_FragColor=toGammaSpace(gl_FragColor);
#endif
}`;h.ShadersStore[re]||(h.ShadersStore[re]=$e);const ne="multiScatteringPixelShader",We=`#define RENDER_MULTI_SCATTERING 1
precision highp float;
#define COMPUTE_MULTI_SCATTERING 1
#include<__decl__atmosphereFragment>
#include<helperFunctions>
#include<atmosphereFunctions>
varying vec2 uv;uniform sampler2D transmittanceLut;void main() {gl_FragColor=renderMultiScattering(uv,transmittanceLut);}`;h.ShadersStore[ne]||(h.ShadersStore[ne]=We);const oe="skyViewPixelShader",Ze=`#define RENDER_SKY_VIEW 1
precision highp float;precision highp sampler2D;
#include<__decl__atmosphereFragment>
#include<helperFunctions>
#include<atmosphereFunctions>
varying vec2 uv;uniform sampler2D transmittanceLut;uniform sampler2D multiScatteringLut;void main() {gl_FragColor=renderSkyView(uv,transmittanceLut,multiScatteringLut);}`;h.ShadersStore[oe]||(h.ShadersStore[oe]=Ze);const se="aerialPerspectivePixelShader",qe=`#define RENDER_CAMERA_VOLUME 1
precision highp float;
#include<__decl__atmosphereFragment>
#include<helperFunctions>
#include<atmosphereFunctions>
varying vec3 positionOnNearPlane;uniform float layerIdx;uniform sampler2D transmittanceLut;uniform sampler2D multiScatteringLut;void main() {gl_FragColor=renderCameraVolume(
positionOnNearPlane,
layerIdx,
transmittanceLut,
multiScatteringLut
);}`;h.ShadersStore[se]||(h.ShadersStore[se]=qe);const ce="atmosphereVertexDeclaration",je=`uniform mat4 inverseViewProjectionWithoutTranslation;
`;h.IncludesShadersStore[ce]||(h.IncludesShadersStore[ce]=je);const Ye="Failed to update html mesh renderer position due to failure to get canvas rect.  HtmlMesh instances may not render correctly",P=100,G=r=>(e,t)=>{const i=e.getMesh(),a=t.getMesh(),n=i.isHtmlMesh,o=a.isHtmlMesh;return n?o&&i.absolutePosition.z<=a.absolutePosition.z?1:-1:o?1:r(e,t)};class j{constructor(e,{parentContainerId:t=null,_containerId:i="css-container",enableOverlayRender:a=!0,defaultOpaqueRenderOrder:n=U.PainterSortCompare,defaultAlphaTestRenderOrder:o=U.PainterSortCompare,defaultTransparentRenderOrder:l=U.defaultTransparentSortCompare}={}){this._cache={cameraData:{fov:0,position:new y,style:""},htmlMeshData:new WeakMap},this._width=0,this._height=0,this._heightHalf=0,this._temp={scaleTransform:new y,rotationTransform:new Ce,positionTransform:new y,objectMatrix:v.Identity(),cameraWorldMatrix:v.Identity(),cameraRotationMatrix:v.Identity(),cameraWorldMatrixAsArray:new Array(16)},this._lastDevicePixelRatio=window.devicePixelRatio,this._cameraMatrixUpdated=!0,this._previousCanvasDocumentPosition={top:0,left:0},this._renderObserver=null,this._onCameraMatrixChanged=c=>{this._cameraWorldMatrix=c.getWorldMatrix(),this._cameraMatrixUpdated=!0},!(typeof document>"u")&&(this._containerId=i,this._init(e,t,a,n,o,l))}dispose(){this._renderObserver&&(this._renderObserver.remove(),this._renderObserver=null),this._overlayElements?.container.remove(),this._overlayElements=null,this._inSceneElements?.container.remove(),this._inSceneElements=null}_init(e,t,i,a,n,o){if(typeof document>"u")return;let l=t?document.getElementById(t):document.body;l||(l=document.body);const c=`${this._containerId}_in_scene`;if(this._inSceneElements=this._createRenderLayerElements(c),l.insertBefore(this._inSceneElements.container,l.firstChild),i){const _=`${this._containerId}_overlay`;this._overlayElements=this._createRenderLayerElements(_);const V=+(e.getEngine().getRenderingCanvas().style.zIndex??"0")+1;this._overlayElements.container.style.zIndex=`${V}`,this._overlayElements.container.style.pointerEvents="none",l.insertBefore(this._overlayElements.container,l.firstChild)}this._engine=e.getEngine();const d=this._engine.getRenderingCanvasClientRect();if(!d)throw new Error("Failed to get client rect for rendering canvas");this._setSize(d.width,d.height),this._engine.onResizeObservable.add(()=>{const _=this._engine.getRenderingCanvasClientRect();_&&this._setSize(_.width,_.height)});let s,m;const p=()=>{const _=e.activeCamera;_&&(s=_.onProjectionMatrixChangedObservable.add(()=>{this._onCameraMatrixChanged(_)}),m=_.onViewMatrixChangedObservable.add(()=>{this._onCameraMatrixChanged(_)}))};p(),e.onActiveCameraChanged.add(()=>{s&&e.activeCamera?.onProjectionMatrixChangedObservable.remove(s),m&&e.activeCamera?.onViewMatrixChangedObservable.remove(m),p()});const u=G(a),f=G(n),g=G(o);e.setRenderingOrder(0,u,f,g),this._renderObserver=e.onBeforeRenderObservable.add(()=>{this._render(e,e.activeCamera)})}_createRenderLayerElements(e){const t=document.getElementById(e);t&&t.remove();const i=document.createElement("div");i.id=e,i.style.position="absolute",i.style.width="100%",i.style.height="100%",i.style.zIndex="-1";const a=document.createElement("div");a.style.overflow="hidden";const n=document.createElement("div");return n.style.webkitTransformStyle="preserve-3d",n.style.transformStyle="preserve-3d",n.style.pointerEvents="none",a.appendChild(n),i.appendChild(a),{container:i,domElement:a,cameraElement:n}}_getSize(){return{width:this._width,height:this._height}}_setSize(e,t){if(this._width=e,this._height=t,this._heightHalf=this._height/2,!this._inSceneElements||!this._overlayElements)return;const i=[this._inSceneElements.domElement,this._overlayElements.domElement,this._inSceneElements.cameraElement,this._overlayElements.cameraElement];for(const a of i)a&&(a.style.width=`${e}px`,a.style.height=`${t}px`)}_getCameraCssMatrix(e){const t=e.m;return`matrix3d(${this._epsilon(t[0])},${this._epsilon(-t[1])},${this._epsilon(t[2])},${this._epsilon(t[3])},${this._epsilon(t[4])},${this._epsilon(-t[5])},${this._epsilon(t[6])},${this._epsilon(t[7])},${this._epsilon(t[8])},${this._epsilon(-t[9])},${this._epsilon(t[10])},${this._epsilon(t[11])},${this._epsilon(t[12])},${this._epsilon(-t[13])},${this._epsilon(t[14])},${this._epsilon(t[15])})`}_getHtmlContentCssMatrix(e,t){const i=e.m,a=t?-1:1;return`matrix3d(${this._epsilon(i[0])},${this._epsilon(i[1])},${this._epsilon(i[2]*-a)},${this._epsilon(i[3])},${this._epsilon(-i[4])},${this._epsilon(-i[5])},${this._epsilon(i[6]*a)},${this._epsilon(-i[7])},${this._epsilon(i[8]*-a)},${this._epsilon(i[9]*-a)},${this._epsilon(i[10])},${this._epsilon(i[11]*a)},${this._epsilon(i[12]*a)},${this._epsilon(i[13]*a)},${this._epsilon(i[14]*a)},${this._epsilon(i[15])})`}_getTransformationMatrix(e,t){if(this._cameraWorldMatrix||(this._cameraWorldMatrix=e.getScene().activeCamera?.getWorldMatrix()),!this._cameraWorldMatrix)return v.Identity();const i=e.getWorldMatrix();let a=1,n=1;e.sourceWidth&&e.sourceHeight&&(a=e.width/(e.sourceWidth/P),n=e.height/(e.sourceHeight/P));const o=this._temp.scaleTransform,l=this._temp.rotationTransform,c=this._temp.positionTransform,d=this._temp.objectMatrix;i.decompose(o,l,c),o.x*=a,o.y*=n,v.ComposeToRef(o,l,c,d);const s=t?-1:1,m=e.getAbsolutePosition();return d.setRowFromFloats(3,(-this._cameraWorldMatrix.m[12]+m.x)*P*s,(-this._cameraWorldMatrix.m[13]+m.y)*P*s,(this._cameraWorldMatrix.m[14]-m.z)*P,this._cameraWorldMatrix.m[15]*j.PROJECTION_SCALE_FACTOR*P),d.multiplyAtIndex(3,P),d.multiplyAtIndex(7,P),d.multiplyAtIndex(11,P),d}_renderHtmlMesh(e,t){if(!e.element||!e.element.firstElementChild)return;let i=this._cache.htmlMeshData.get(e);i||(i={style:""},this._cache.htmlMeshData.set(e,i));const a=e._isCanvasOverlay?this._overlayElements?.cameraElement:this._inSceneElements?.cameraElement;e.element.parentNode!==a&&a.appendChild(e.element),e.requiresUpdate&&this._updateBaseScaleFactor(e);const n=this._getTransformationMatrix(e,t);let o=`translate(-50%, -50%) ${this._getHtmlContentCssMatrix(n,t)}`;o+=`${t?`matrix3d(${e.billboardMode!==k.BILLBOARDMODE_NONE?1:-1}, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1)`:""}`,i.style!==o&&(e.element.style.webkitTransform=o,e.element.style.transform=o),e._markAsUpdated()}_render(e,t){let i=!1;const a=e.useRightHandedSystem;this._updateContainerPositionIfNeeded(),this._cameraMatrixUpdated&&(this._cameraMatrixUpdated=!1,i=!0),(t.position.x!==this._cache.cameraData.position.x||t.position.y!==this._cache.cameraData.position.y||t.position.z!==this._cache.cameraData.position.z)&&(this._cache.cameraData.position.copyFrom(t.position),i=!0),window.devicePixelRatio!==this._lastDevicePixelRatio&&(this._lastDevicePixelRatio=window.devicePixelRatio,E.Log("In render - dpr changed: ",this._lastDevicePixelRatio),i=!0);const n=e.meshes.filter(f=>f.isHtmlMesh&&(i||f.requiresUpdate));if(i=i||n.length>0,!i)return;const l=t.getProjectionMatrix().m[5]*this._heightHalf;if(this._cache.cameraData.fov!==l){const f=[this._overlayElements?.domElement,this._inSceneElements?.domElement];if(t.mode==Le.PERSPECTIVE_CAMERA)for(const g of f)g&&(g.style.webkitPerspective=l+"px",g.style.perspective=l+"px");else for(const g of f)g&&(g.style.webkitPerspective="",g.style.perspective="");this._cache.cameraData.fov=l}t.parent===null&&t.computeWorldMatrix();const c=this._temp.cameraWorldMatrix;c.copyFrom(t.getWorldMatrix());const d=this._temp.cameraRotationMatrix;c.getRotationMatrix().transposeToRef(d);const s=this._temp.cameraWorldMatrixAsArray;c.copyToArray(s);const m=a?1:-1;s[1]=d.m[1],s[2]=d.m[2]*m,s[4]=d.m[4]*m,s[6]=d.m[6]*m,s[8]=d.m[8]*m,s[9]=d.m[9]*m,v.FromArrayToRef(s,0,c);const u=this._getCameraCssMatrix(c);if(this._cache.cameraData.style!==u){const f=[this._inSceneElements?.cameraElement,this._overlayElements?.cameraElement];for(const g of f)g&&(g.style.webkitTransform=u,g.style.transform=u);this._cache.cameraData.style=u}for(const f of n)this._renderHtmlMesh(f,a)}_updateBaseScaleFactor(e){let t=this._width,i=this._height;const a=(e.width||1)/(e.height||1),n=t/i;a>n?t=i*a:i=t/a,e.setContentSizePx(t,i)}_updateContainerPositionIfNeeded(){const e=this._engine.getRenderingCanvasClientRect();if(!e){E.Warn(Ye);return}const t=window.scrollY,i=window.scrollX,a=e.top+t,n=e.left+i;if(this._previousCanvasDocumentPosition.top!==a||this._previousCanvasDocumentPosition.left!==n){this._previousCanvasDocumentPosition.top=a,this._previousCanvasDocumentPosition.left=n;const o=[this._inSceneElements?.container,this._overlayElements?.container];for(const l of o){if(!l)continue;const c=l.offsetParent,d=c.getBoundingClientRect(),s=d.top+t,m=d.left+i,p=this._getAncestorMarginsAndPadding(c),u=window.getComputedStyle(document.body),f=parseInt(u.marginTop,10),g=parseInt(u.marginLeft,10);l.style.top=`${a-s-p.marginTop+p.paddingTop+f}px`,l.style.left=`${n-m-p.marginLeft+p.paddingLeft+g}px`}}}_epsilon(e){return Math.abs(e)<1e-10?0:e}_getAncestorMarginsAndPadding(e){let t=0,i=0,a=0,n=0;for(;e&&e!==document.body&&e!==document.documentElement;){const o=window.getComputedStyle(e);t+=parseInt(o.marginTop,10),i+=parseInt(o.marginLeft,10),a+=parseInt(o.paddingTop,10),n+=parseInt(o.paddingLeft,10),e=e.offsetParent}return{marginTop:t,marginLeft:i,paddingTop:a,paddingLeft:n}}}j.PROJECTION_SCALE_FACTOR=1e-5;let M=[];const R=new Map;let D=[],S=null;const Ke=()=>S,Je=(r,e,t)=>{if(C(`In pointerEventsCapture.requestCapture - Pointer events capture requested for ${r}`),tt(r)){C(`In pointerEventsCapture.requestCapture - Capture request matched previous release request ${r}.  Cancelling capture request`);return}else r!==S&&Qe(r,e,t);S||ue()},me=r=>{C(`In pointerEventsCapture.requestRelease - Pointer events release requested for ${r}`),!r||r===S?ue():et(r)?R.delete(r):(C(`In pointerEventsCapture.requestRelease - Received release request ${r} but no matching capture request was received`),D.includes(r)||D.push(r))},Xe=()=>{me(S)},Qe=(r,e,t)=>{C(`In pointerEventsCapture.enqueueCaptureRequest - Enqueueing capture request for  ${r}`),M.includes(r)||(M.push(r),R.set(r,{capture:e,release:t}))},et=r=>{let e=!1;return M=M.filter(t=>t!==r?!0:(e=!0,C(`In pointerEventsCapture.cancelRequest - Canceling pointer events capture request ${r}`),!1)),e},tt=r=>{let e=!1;return D=D.filter(t=>t!==r?!0:(e=!0,!1)),e},ue=()=>{const r=rt();C(`In pointerEventsCapture.transferPointerEventsOwnership - Transferrring pointer events from ${S} to ${r}`),it(),r&&at(r)},it=()=>{C(`In pointerEventsCapture.doRelease - Releasing pointer events from ${S}`),S&&(R.get(S)?.release(),R.delete(S),S=null)},at=r=>{r&&R.get(r)?.capture(),S=r,C(`In pointerEventsCapture.doCapture - Pointer events now captured by ${r}`)},rt=()=>M.length>0?M.shift():null,C=r=>{(typeof window>"u"||window["pointer-events-capture-debug"])&&Ee.Log(`${performance.now()} - game.scene.pointerEvents - ${r}
currentOwner: ${S}
queue: ${M}
unmatched: ${D}`)};let L=null,I=0;const z=new WeakMap,le=r=>{typeof document>"u"||(I===0&&(document.addEventListener("pointermove",H),document.addEventListener("touchstart",H),L=L??r,E.Log("PointerEventsCaptureBehavior: Starting observation of pointer move events."),L.onDisposeObservable.add(pe)),I++)},pe=()=>{document.removeEventListener("pointermove",H),document.removeEventListener("touchstart",H),L=null,E.Log("PointerEventsCaptureBehavior: Stopping observation of pointer move events."),I=0},de=()=>{typeof document>"u"||L&&(I--,I<=0&&pe())},H=r=>{if(!L)return;const e=L.getEngine().getRenderingCanvasClientRect();if(!e)return;const{clientX:t,clientY:i}="touches"in r?r.touches[0]:r,a=t-e.left,n=i-e.top;let o;const l=L.pick(a,n,s=>{const m=z.get(s);return s.isEnabled()&&typeof m<"u"&&m._captureOnPointerEnter});let c;l.hit?c=l.pickedMesh:c=null;const d=parseInt(Ke()||"");c&&c.uniqueId===d||(d&&(!c||c.uniqueId!==d)&&Xe(),c&&(o=z.get(c),o.capturePointerEvents()))};class nt{get attachedMesh(){return this._attachedMesh}set attachedMesh(e){this._attachedMesh=e}get attachedNode(){return this._attachedMesh}constructor(e,t,{captureOnPointerEnter:i=!0}={}){this._captureCallback=e,this._releaseCallback=t,this.name="PointerEventsCaptureBehavior",this._attachedMesh=null,this._captureOnPointerEnter=i,typeof document>"u"&&E.Warn("Creating an instance of PointerEventsCaptureBehavior outside of a browser.  The behavior will not work.")}set captureOnPointerEnter(e){this._captureOnPointerEnter!==e&&(this._captureOnPointerEnter=e,this._attachedMesh&&(this._captureOnPointerEnter?le(this._attachedMesh.getScene()):de()))}init(){}attach(e){this.attachedMesh=e,z.set(e,this),this._captureOnPointerEnter&&le(e.getScene())}detach(){this.attachedMesh&&(z.delete(this.attachedMesh),this._captureOnPointerEnter&&de(),this.attachedMesh=null)}dispose(){this.detach()}releasePointerEvents(){this.attachedMesh&&me(this.attachedMesh.uniqueId.toString())}capturePointerEvents(){this.attachedMesh&&Je(this.attachedMesh.uniqueId.toString(),this._captureCallback,this._releaseCallback)}}const ot={wrapElement(r){const e=document.createElement("div");e.style.display="flex",e.style.justifyContent="center",e.style.alignItems="center";const t=document.createElement("div");return t.style.visibility="hidden",t.appendChild(r),e.appendChild(t),e},updateSize(r,e,t){const i=r.firstElementChild;r.style.width=`${e}px`,r.style.height=`${t}px`;const[a,n]=[i.offsetWidth,i.offsetHeight],o=Math.min(e/a,t/n);i.style.transform=`scale(${o})`,i.style.visibility="visible"}},st={wrapElement(r){const e=document.createElement("div");e.style.display="flex",e.style.justifyContent="center",e.style.alignItems="center",e.style.overflow="hidden";const t=document.createElement("div");return t.style.visibility="hidden",t.appendChild(r),e.appendChild(t),e},updateSize(r,e,t){const i=r.firstElementChild;r.style.width=`${e}px`,r.style.height=`${t}px`;const[a,n]=[i.offsetWidth,i.offsetHeight],o=Math.max(e/a,t/n);i.style.transform=`scale(${o})`,i.style.visibility="visible"}},ct={wrapElement(r){const e=document.createElement("div");e.style.display="flex",e.style.justifyContent="center",e.style.alignItems="center";const t=document.createElement("div");return t.style.visibility="hidden",t.appendChild(r),e.appendChild(t),e},updateSize(r,e,t){const i=r.firstElementChild;r.style.width=`${e}px`,r.style.height=`${t}px`;const[a,n]=[i.offsetWidth,i.offsetHeight];i.style.transform=`scale(${e/a}, ${t/n})`,i.style.visibility="visible"}},lt={wrapElement(r){return r},updateSize(r,e,t){r&&(r.style.width=`${e}px`,r.style.height=`${t}px`)}},he={CONTAIN:ot,COVER:st,STRETCH:ct,NONE:lt};class _t extends F{get isHtmlMesh(){return!0}get sourceWidth(){return this._sourceWidth}get sourceHeight(){return this._sourceHeight}constructor(e,t,{captureOnPointerEnter:i=!0,isCanvasOverlay:a=!1,fitStrategy:n=he.NONE}={}){if(super(t,e),this._enabled=!1,this._ready=!1,this._isCanvasOverlay=!1,this._requiresUpdate=!0,this._inverseScaleMatrix=null,this._captureOnPointerEnter=!0,this._pointerEventCaptureBehavior=null,this._sourceWidth=null,this._sourceHeight=null,this._fitStrategy=he.NONE,typeof document>"u"){E.Warn(`Creating an instance of an HtmlMesh with id ${t} outside of a browser.  The mesh will not be visible.`);return}this._fitStrategy=n,this._isCanvasOverlay=a,this._createMask(),this._element=this._createElement(),this.setEnabled(!0),this._captureOnPointerEnter=i,this._pointerEventCaptureBehavior=new nt(this.capturePointerEvents.bind(this),this.releasePointerEvents.bind(this),{captureOnPointerEnter:this._captureOnPointerEnter}),this.addBehavior(this._pointerEventCaptureBehavior)}get width(){return this._width}get height(){return this._height}get element(){return this._element}get requiresUpdate(){return this._requiresUpdate}set captureOnPointerEnter(e){this._captureOnPointerEnter=e,this._pointerEventCaptureBehavior&&(this._pointerEventCaptureBehavior.captureOnPointerEnter=e)}dispose(){super.dispose(),this._element?.remove(),this._element=void 0,this._pointerEventCaptureBehavior&&(this._pointerEventCaptureBehavior.dispose(),this._pointerEventCaptureBehavior=null)}_markAsUpdated(){this._requiresUpdate=!1}setContent(e,t,i){this._setAsReady(!1),this._sourceWidth=null,this._sourceHeight=null,this._element&&(this._width=t,this._height=i,this._requiresUpdate=!0,this.scaling.setAll(1),e&&(this._element.appendChild(this._fitStrategy.wrapElement(e)),this._updateScaleIfNecessary()),this.sourceWidth&&this.sourceHeight&&this._setAsReady(!0))}setEnabled(e){this._enabled=e,(!e||this._ready)&&this._doSetEnabled(e)}setContentSizePx(e,t){this._sourceWidth=e,this._sourceHeight=t,!(!this._element||!this._element.firstElementChild)&&(this._fitStrategy.updateSize(this._element.firstElementChild,e,t),this._updateScaleIfNecessary(),this.width&&this.height&&this._setAsReady(!0))}_setAsReady(e){this._ready=e,e?this._doSetEnabled(this._enabled):this._doSetEnabled(!1)}_doSetEnabled(e){this._element&&(e&&!this._worldMatrixUpdateObserver?this._worldMatrixUpdateObserver=this.onAfterWorldMatrixUpdateObservable.add(()=>{this._requiresUpdate=!0}):e||(this._worldMatrixUpdateObserver?.remove(),this._worldMatrixUpdateObserver=null),this._element.style.display=e?"":"none",this._setElementzIndex(this.position.z*-1e4),super.setEnabled(e))}_updateScaleIfNecessary(){this.scaling.setAll(1),this._inverseScaleMatrix&&(this.bakeTransformIntoVertices(this._inverseScaleMatrix),this._inverseScaleMatrix=null);const e=this._width||1,t=this._height||1,i=v.Scaling(e,t,1);this.bakeTransformIntoVertices(i),this._inverseScaleMatrix=new v,i.invertToRef(this._inverseScaleMatrix)}_createMask(){Me({width:1,height:1}).applyToMesh(this);const t=this.getScene();this.checkCollisions=!0;const i=new B(`${this.id}-mat`,t);this._isCanvasOverlay||(i.backFaceCulling=!1,i.disableColorWrite=!0,i.disableLighting=!0),this.material=i,this.material.freeze()}_setElementzIndex(e){this._element&&(this._element.style.zIndex=`${e}`)}capturePointerEvents(){this._element&&(this._element.style.pointerEvents="auto",document.getElementsByTagName("body")[0].style.pointerEvents="none")}releasePointerEvents(){this._element&&(document.getElementsByTagName("body")[0].style.pointerEvents="auto",this._element.style.pointerEvents="none")}_createElement(){if(typeof document>"u")return;const e=document.createElement("div");return e.id=this.id,e.style.backgroundColor=this._isCanvasOverlay?"transparent":"#000",e.style.zIndex="1",e.style.position="absolute",e.style.pointerEvents="none",e.style.backfaceVisibility="hidden",e}}var w;(function(r){r[r.SPACE=32]="SPACE",r[r.TOFU=65532]="TOFU"})(w||(w={}));class St{constructor(e,t,i){this._chars=new Map,this._kernings=new Map,this._font=JSON.parse(e),this._font.pages=[t],this._font.chars.forEach(a=>this._chars.set(a.id,a)),this._font.kernings.forEach(a=>{let n=this._kernings.get(a.first);n||(n=new Map,this._kernings.set(a.first,n)),n.set(a.second,a.amount)}),this._charsRegex=new RegExp(`[${this._font.chars.map(a=>a.char.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,"\\$&")).join("")}]`,"g"),this._updateFallbacks(),this.scale=1/this._font.info.size,this.textures=this._font.pages.map(a=>{const n=new xe(a,i,{noMipmap:!1,invertY:!1});return n.anisotropicFilteringLevel=16,n})}dispose(){for(const e of this.textures)e.dispose();this.textures.length=0}_updateFallbacks(){this._chars.has(w.SPACE)||this._chars.set(w.SPACE,{id:w.SPACE,x:0,y:0,width:0,height:0,xoffset:0,yoffset:0,xadvance:this._font.info.size*.5,page:-1,chnl:-1,index:-1,char:" "}),this._chars.has(w.TOFU)||this._chars.set(w.TOFU,{id:w.TOFU,x:0,y:0,width:this._font.info.size,height:this._font.info.size,xoffset:0,yoffset:0,xadvance:this._font.info.size*.5,page:-1,chnl:-1,index:-1,char:"￿"})}_getChar(e){return this._chars.get(e)||this._chars.get(w.TOFU)}_getKerning(e,t){return this._kernings.get(e)?.get(t)||0}_unsupportedChars(e){return e.replace(this._charsRegex,"")}}const $="msdfVertexShader",fe=`#define BILLBOARD 1
#define BILLBOARDSCREENPROJECTED 2
attribute vec2 offsets;attribute vec4 world0;attribute vec4 world1;attribute vec4 world2;attribute vec4 world3;attribute vec4 uvs;uniform mat4 transform;uniform mat4 parentWorld;uniform mat4 view;uniform mat4 projection;uniform vec3 center;uniform int mode;varying vec2 atlasUV;void main(void) {mat4 world=mat4(world0,world1,world2,world3);vec4 worldPos=transform*(world*vec4(offsets.xy-vec2(0.5,0.5),0.,1.0));if (mode>=BILLBOARD) {vec3 viewPos=(view*parentWorld*vec4(0.,0.,0.,1.0)).xyz; 
if (mode==BILLBOARDSCREENPROJECTED) {viewPos.x/=viewPos.z;viewPos.y/=viewPos.z;viewPos.z=1.0;}
gl_Position=projection*vec4(viewPos+worldPos.xyz,1.0); } else {vec3 viewPos=(view*parentWorld*worldPos).xyz; 
gl_Position=projection*vec4(viewPos,1.0); }
atlasUV=vec2(uvs.x+offsets.x*uvs.z,uvs.y+(1.0-offsets.y)*uvs.w);}`;h.ShadersStore[$]||(h.ShadersStore[$]=fe);const dt={name:$,shader:fe},yt=Object.freeze(Object.defineProperty({__proto__:null,msdfVertexShader:dt},Symbol.toStringTag,{value:"Module"})),W="msdfPixelShader",ge=`#extension GL_OES_standard_derivatives : enable
precision highp float;uniform sampler2D fontAtlas;uniform vec4 uColor;uniform vec4 uStrokeColor;uniform float uStrokeInsetWidth;uniform float uStrokeOutsetWidth;uniform float thickness;varying vec2 atlasUV;float median(vec3 msdf) {return max(min(msdf.r,msdf.g),min(max(msdf.r,msdf.g),msdf.b));}
void main(void)
{vec3 s=texture2D(fontAtlas,atlasUV).rgb;float sigDist=median(s)-0.5+thickness;float alpha=clamp(sigDist/fwidth(sigDist)+0.5,0.0,1.0);float sigDistOutset=sigDist+uStrokeOutsetWidth*0.5;float sigDistInset=sigDist-uStrokeInsetWidth*0.5;float outset=clamp(sigDistOutset/fwidth(sigDistOutset)+0.5,0.0,1.0);float inset=1.0-clamp(sigDistInset/fwidth(sigDistInset)+0.5,0.0,1.0);float border=outset*inset;vec4 filledFragColor=vec4(uColor.rgb,alpha*uColor.a);vec4 strokedFragColor=vec4(uStrokeColor.rgb,border*uStrokeColor.a);gl_FragColor=mix(filledFragColor,strokedFragColor,border);}`;h.ShadersStore[W]||(h.ShadersStore[W]=ge);const ht={name:W,shader:ge},Tt=Object.freeze(Object.defineProperty({__proto__:null,msdfPixelShader:ht},Symbol.toStringTag,{value:"Module"})),Z="msdfVertexShader",ve=`#define BILLBOARD 1
#define BILLBOARDSCREENPROJECTED 2
attribute offsets: vec2f;attribute world0: vec4f;attribute world1: vec4f;attribute world2: vec4f;attribute world3: vec4f;attribute uvs: vec4f;uniform transform: mat4x4f;uniform parentWorld: mat4x4f;uniform view: mat4x4f;uniform projection: mat4x4f;uniform mode: u32;varying atlasUV: vec2f;@vertex
fn main(input: VertexInputs)->FragmentInputs {let world=mat4x4<f32>(input.world0,input.world1,input.world2,input.world3);let localOffset=vec4<f32>(input.offsets-vec2<f32>(0.5,0.5),0.0,1.0);let worldPos=uniforms.transform*world*localOffset;if (uniforms.mode>=BILLBOARD) { 
var viewPos=(uniforms.view*uniforms.parentWorld*vec4f(0.,0.,0.,1.0)).xyz;if (uniforms.mode==BILLBOARDSCREENPROJECTED) {viewPos=vec3f(viewPos.x/viewPos.z,viewPos.y/viewPos.z,1.0);} 
vertexOutputs.position=uniforms.projection*vec4<f32>(viewPos+worldPos.xyz,1.0);} else { 
let viewPos=(uniforms.view*uniforms.parentWorld*worldPos).xyz;vertexOutputs.position=uniforms.projection*vec4<f32>(viewPos,1.0);}
vertexOutputs.atlasUV=vec2<f32>(
input.uvs.x+input.offsets.x*input.uvs.z,
input.uvs.y+(1.0-input.offsets.y)*input.uvs.w
);}`;h.ShadersStoreWGSL[Z]||(h.ShadersStoreWGSL[Z]=ve);const mt={name:Z,shader:ve},At=Object.freeze(Object.defineProperty({__proto__:null,msdfVertexShaderWGSL:mt},Symbol.toStringTag,{value:"Module"})),q="msdfPixelShader",_e=`var fontAtlas: texture_2d<f32>;var fontAtlasSampler: sampler;uniform uColor: vec4f;uniform thickness: f32;uniform uStrokeColor: vec4f;uniform uStrokeInsetWidth: f32;uniform uStrokeOutsetWidth: f32;varying atlasUV: vec2f;fn median(msdf: vec3<f32>)->f32 {let a=min(msdf.r,msdf.g);let b=max(msdf.r,msdf.g);return max(a,min(b,msdf.b));}
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {let s=textureSample(fontAtlas,fontAtlasSampler,input.atlasUV).rgb;let sigDist=median(s)-0.5+uniforms.thickness;let afwidth=length(vec2<f32>(dpdx(sigDist),dpdy(sigDist)));let alpha=clamp(sigDist/afwidth+0.5,0.0,1.0);let sigDistOutset=sigDist+uniforms.uStrokeOutsetWidth*0.5;let sigDistInset=sigDist-uniforms.uStrokeInsetWidth*0.5;let afwidthOutset=length(vec2<f32>(dpdx(sigDistOutset),dpdy(sigDistOutset)));let afwidthInset=length(vec2<f32>(dpdx(sigDistInset),dpdy(sigDistInset)));let outset=clamp(sigDistOutset/afwidthOutset+0.5,0.0,1.0);let inset=1.0-clamp(sigDistInset/afwidthInset+0.5,0.0,1.0);let border=outset*inset;let filledFragColor=vec4<f32>(uniforms.uColor.rgb,alpha*uniforms.uColor.a);let strokedFragColor=vec4<f32>(uniforms.uStrokeColor.rgb,border*uniforms.uStrokeColor.a);fragmentOutputs.color=mix(filledFragColor,strokedFragColor,border);}`;h.ShadersStoreWGSL[q]||(h.ShadersStoreWGSL[q]=_e);const ut={name:q,shader:_e},Pt=Object.freeze(Object.defineProperty({__proto__:null,msdfPixelShaderWGSL:ut},Symbol.toStringTag,{value:"Module"}));function pt(){if(!x)throw new Error("Recast is not initialized. Please call InitRecast first.");return x}let x,N=null;async function wt(r){const t={url:"https://unpkg.com/@recast-navigation",version:r?.version??"0.43.0",...r};if(!x){if(N){await N;return}if(t.instance)x=t.instance;else{N=ft(t.url,t.version);const i=await N;x={...i.core,...i.generators},await x.init()}}}async function ft(r,e){const t={imports:{"@recast-navigation/core":`${r}/core@${e}/dist/index.mjs`,"@recast-navigation/wasm":`${r}/wasm@${e}/dist/recast-navigation.wasm-compat.js`,"@recast-navigation/generators":`${r}/generators@${e}/dist/index.mjs`}},i=document.createElement("script");return i.type="importmap",i.textContent=JSON.stringify(t),document.body.appendChild(i),await Re(`
                import * as CoreModule from '${r}/core@${e}/dist/index.mjs';
                import * as GeneratorsModule from '${r}/generators@${e}/dist/index.mjs';
                const returnedValue =  {core: CoreModule, generators: GeneratorsModule};
            `)}const A={HEIGHTFIELD_SOLID:"heightfield solid",HEIGHTFIELD_WALKABLE:"heightfield walkable",COMPACT_HEIGHTFIELD_SOLID:"compact heightfield solid",COMPACT_HEIGHTFIELD_REGIONS:"compact heightfield regions",COMPACT_HEIGHTFIELD_DISTANCE:"compact heightfield distance",RAW_CONTOURS:"raw contours",CONTOURS:"contours",POLY_MESH:"poly mesh",POLY_MESH_DETAIL:"poly mesh detail",NAVMESH:"navmesh",NAVMESH_BV_TREE:"navmesh bv tree"};class T{get primitiveTypes(){return this._primitiveTypes}set primitiveTypes(e){this._primitiveTypes=e}constructor(e,t){this._scene=e,this.lineMaterials=[],this.getIntermediates=a=>{const n=[],o=[],l=[],c=[],d=[];if(a){if(a.type==="solo")a.heightfield&&n.push(a.heightfield),a.compactHeightfield&&o.push(a.compactHeightfield),a.contourSet&&l.push(a.contourSet),a.polyMesh&&c.push(a.polyMesh),a.polyMeshDetail&&d.push(a.polyMeshDetail);else if(a.type==="tiled")for(const s of a.tileIntermediates)s.heightfield&&n.push(s.heightfield),s.compactHeightfield&&o.push(s.compactHeightfield),s.contourSet&&l.push(s.contourSet),s.polyMesh&&c.push(s.polyMesh),s.polyMeshDetail&&d.push(s.polyMeshDetail);else if(a.type==="tilecache")for(const s of a.tileIntermediates)s.heightfield&&n.push(s.heightfield),s.compactHeightfield&&o.push(s.compactHeightfield)}return{heightfieldList:n,compactHeightfieldList:o,contourSetList:l,polyMeshList:c,polyMeshDetailList:d}},this._debugDrawerUtils=new(pt()).DebugDrawerUtils,this._primitiveTypes=t?.primitiveTypes??["points","lines","tris","quads"],this.debugDrawerParentNode=t?.parent?.node instanceof k?t.parent.node:new k(t?.parent?.node??"nav-mesh-debug-parent",this._scene);const i=t?.materials;i?.triMaterial?this.triMaterial=i.triMaterial:(this.triMaterial=new B("nav-debug-tris-material"),this.triMaterial.backFaceCulling=!1,this.triMaterial.specularColor=O.Black(),this.triMaterial.alpha=.5),i?.pointMaterial?this.pointMaterial=i.pointMaterial:(this.pointMaterial=new B("nav-debug-points-material"),this.pointMaterial.backFaceCulling=!1,this.pointMaterial.specularColor=O.Black()),i?.lineMaterialOptions?this._lineMaterialOptions=i.lineMaterialOptions:this._lineMaterialOptions={greasedLineMaterialOptions:{width:2,sizeAttenuation:!0},greasedLineMeshOptions:{}},this._pointMesh=De(T.NAV_MESH_DEBUG_NAME_POINTS,{size:.02})}clear(){for(const e of this.debugDrawerParentNode.getChildMeshes())e.dispose()}dispose(){this.clear(),this._debugDrawerUtils.dispose(),this._pointMesh.dispose(),this.triMaterial.dispose(),this.pointMaterial.dispose()}drawPrimitives(e,t){let i=null;for(const a of e)if(this._primitiveTypes.includes(a.type))switch(a.type){case"points":this._drawPoints(a);break;case"lines":{const n=this._drawLines(a,i);i||(i=n);break}case"tris":this._drawTris(a);break;case"quads":this._drawQuads(a);break}i?.updateLazy(),(t?.joinMeshes??!0)&&this._joinDebugMeshes()}drawHeightfieldSolid(e){const t=this._debugDrawerUtils.drawHeightfieldSolid(e);this.drawPrimitives(t)}drawHeightfieldWalkable(e){const t=this._debugDrawerUtils.drawHeightfieldWalkable(e);this.drawPrimitives(t)}drawCompactHeightfieldSolid(e){const t=this._debugDrawerUtils.drawCompactHeightfieldSolid(e);this.drawPrimitives(t)}drawCompactHeightfieldRegions(e){const t=this._debugDrawerUtils.drawCompactHeightfieldRegions(e);this.drawPrimitives(t)}drawCompactHeightfieldDistance(e){const t=this._debugDrawerUtils.drawCompactHeightfieldDistance(e);this.drawPrimitives(t)}drawHeightfieldLayer(e,t){const i=this._debugDrawerUtils.drawHeightfieldLayer(e,t);this.drawPrimitives(i)}drawHeightfieldLayers(e){const t=this._debugDrawerUtils.drawHeightfieldLayers(e);this.drawPrimitives(t)}drawRegionConnections(e,t=1){const i=this._debugDrawerUtils.drawRegionConnections(e,t);this.drawPrimitives(i)}drawRawContours(e,t=1){const i=this._debugDrawerUtils.drawRawContours(e,t);this.drawPrimitives(i)}drawContours(e,t=1){const i=this._debugDrawerUtils.drawContours(e,t);this.drawPrimitives(i)}drawPolyMesh(e){const t=this._debugDrawerUtils.drawPolyMesh(e);this.drawPrimitives(t)}drawPolyMeshDetail(e){const t=this._debugDrawerUtils.drawPolyMeshDetail(e);this.drawPrimitives(t)}drawNavMesh(e,t=0){const i=this._debugDrawerUtils.drawNavMesh(e,t);this.drawPrimitives(i)}drawNavMeshWithClosedList(e,t,i=0){const a=this._debugDrawerUtils.drawNavMeshWithClosedList(e,t,i);this.drawPrimitives(a)}drawNavMeshNodes(e){const t=this._debugDrawerUtils.drawNavMeshNodes(e);this.drawPrimitives(t)}drawNavMeshBVTree(e){const t=this._debugDrawerUtils.drawNavMeshBVTree(e);this.drawPrimitives(t)}drawNavMeshPortals(e){const t=this._debugDrawerUtils.drawNavMeshPortals(e);this.drawPrimitives(t)}drawNavMeshPolysWithFlags(e,t,i){const a=this._debugDrawerUtils.drawNavMeshPolysWithFlags(e,t,i);this.drawPrimitives(a)}drawNavMeshPoly(e,t,i){const a=this._debugDrawerUtils.drawNavMeshPoly(e,t,i);this.drawPrimitives(a)}draw(e,t,i,a){this.clear();const{heightfieldList:n,compactHeightfieldList:o,contourSetList:l,polyMeshList:c,polyMeshDetailList:d}=this.getIntermediates(t);if(a===A.HEIGHTFIELD_SOLID)for(const s of n)this.drawHeightfieldSolid(s);else if(a===A.HEIGHTFIELD_WALKABLE)for(const s of n)this.drawHeightfieldWalkable(s);else if(a===A.COMPACT_HEIGHTFIELD_SOLID)for(const s of o)this.drawCompactHeightfieldSolid(s);else if(a===A.COMPACT_HEIGHTFIELD_REGIONS)for(const s of o)this.drawCompactHeightfieldRegions(s);else if(a===A.COMPACT_HEIGHTFIELD_DISTANCE)for(const s of o)this.drawCompactHeightfieldDistance(s);else if(a===A.RAW_CONTOURS)for(const s of l)this.drawRawContours(s);else if(a===A.CONTOURS)for(const s of l)this.drawContours(s);else if(a===A.POLY_MESH)for(const s of c)this.drawPolyMesh(s);else if(a===A.POLY_MESH_DETAIL)for(const s of d)this.drawPolyMeshDetail(s);else a===A.NAVMESH?this.drawNavMesh(e):a===A.NAVMESH_BV_TREE&&this.drawNavMeshBVTree(e)}_drawPoints(e){if(e.vertices.length===0)return;const t=new Float32Array(16*e.vertices.length),i=new Float32Array(4*e.vertices.length);for(let a=0;a<e.vertices.length;a++){const[n,o,l,c,d,s,m]=e.vertices[a];i[a*4]=c,i[a*4+1]=d,i[a*4+2]=s,i[a*4+3]=m,v.Translation(n,o,l).copyToArray(t,a*16)}this._pointMesh.thinInstanceSetBuffer("matrix",t,16),this._pointMesh.thinInstanceSetBuffer("color",i,4),this._pointMesh.parent=this.debugDrawerParentNode}_drawLines(e,t){if(e.vertices.length===0)return null;const i=[],a=[];for(let c=0;c<e.vertices.length;c+=2){const[d,s,m,p,u,f]=e.vertices[c],[g,_,V,Se,ye,Te]=e.vertices[c+1];i.push([d,s,m,g,_,V]),a.push(new O(p,u,f)),a.push(new O(Se,ye,Te))}const n={...this._lineMaterialOptions.greasedLineMeshOptions,points:i,instance:t??void 0},o={...this._lineMaterialOptions.greasedLineMaterialOptions,colors:a},l=Ie(T.NAV_MESH_DEBUG_NAME_LINES,n,o);return l.parent=this.debugDrawerParentNode,this.lineMaterials.push(l.material),l}_drawTris(e){if(e.vertices.length===0)return;const t=new Float32Array(e.vertices.length*3),i=new Float32Array(e.vertices.length*4);for(let o=0;o<e.vertices.length;o++){const[l,c,d,s,m,p]=e.vertices[o];t[o*3+0]=l,t[o*3+1]=c,t[o*3+2]=d,i[o*4+0]=s,i[o*4+1]=m,i[o*4+2]=p,i[o*4+3]=1}const a=new b;a.positions=t,a.colors=i;const n=new F(T.NAV_MESH_DEBUG_NAME_TRIS);n.isUnIndexed=!0,a.applyToMesh(n),n.material=this.triMaterial,n.parent=this.debugDrawerParentNode}_drawQuads(e){if(e.vertices.length===0)return;const t=[],i=[];for(let o=0;o<e.vertices.length;o+=4){const l=[e.vertices[o],e.vertices[o+1],e.vertices[o+2],e.vertices[o],e.vertices[o+2],e.vertices[o+3]];for(const[c,d,s,m,p,u]of l)t.push(c,d,s),i.push(m,p,u,1)}const a=new b;a.positions=t,a.colors=i;const n=new F(T.NAV_MESH_DEBUG_NAME_QUADS);n.isUnIndexed=!0,a.applyToMesh(n),n.material=this.triMaterial,n.parent=this.debugDrawerParentNode}_joinDebugMeshes(){const e=this._scene.meshes.filter(i=>i.name===T.NAV_MESH_DEBUG_NAME);e.forEach(i=>{this._convertUnindexedToIndexed(i)});const t=F.MergeMeshes(e,!0);t&&(t.name=T.NAV_MESH_DEBUG_NAME,t.parent=this.debugDrawerParentNode)}_convertUnindexedToIndexed(e){const i=b.ExtractFromMesh(e).positions;if(!i||i.length%9!==0){E.Warn("Mesh must be fully unindexed with triangles.");return}const a=i.length/3,n=Array.from({length:a},(l,c)=>c),o=new b;o.positions=i,o.indices=n,o.applyToMesh(e,!0)}}T.NAV_MESH_DEBUG_NAME="nav-mesh-debug";T.NAV_MESH_DEBUG_NAME_POINTS="nav-mesh-debug-points";T.NAV_MESH_DEBUG_NAME_TRIS="nav-mesh-debug-tris";T.NAV_MESH_DEBUG_NAME_QUADS="nav-mesh-debug-quads";T.NAV_MESH_DEBUG_NAME_LINES="nav-mesh-debug-lines";export{vt as A,A as D,he as F,pt as G,_t as H,wt as I,T as N,nt as P,St as a,j as b,ut as c,dt as d,mt as e,yt as f,Tt as g,At as h,Pt as i,ht as m};
