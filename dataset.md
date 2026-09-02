Here's where to get each piece — imagery and labels are separate needs, and the sourcing differs.

## Satellite imagery (Sentinel-2, for your 6-channel stack)

| Source                                                                                    | Link                                     | Notes                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Copernicus Data Space Ecosystem_ (official ESA portal, replaced the old Open Access Hub) | https://dataspace.copernicus.eu          | Free registration, direct download of Sentinel-2 L2A (atmospherically corrected) tiles — this is what you want, not L1C                                                                                                       |
| _Google Earth Engine_                                                                     | https://earthengine.google.com           | Zero download needed — query/clip/export Sentinel-2 composites for your exact watershed AOI directly in code (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")). Fastest option if you're comfortable with the JS/Python API |
| _AWS Open Data (Sentinel-2 COGs)_                                                         | s3://sentinel-cogs/sentinel-s2-l2a-cogs/ | No registration, direct S3 access, cloud-optimized GeoTIFFs                                                                                                                                                                   |
| _USGS EarthExplorer_                                                                      | https://earthexplorer.usgs.gov           | Alternative if Copernicus is slow; free account                                                                                                                                                                               |

Earth Engine is probably your fastest path — you can pull a cloud-masked, NDVI/NDWI-ready composite for a specific watershed polygon in a few lines of Python, no bulk download needed.

## Bhoonidhi — ISRO's actual satellite data download portal

Note: your plan mentions "Bhoonidhi" separately from Bhuvan — that's correct, they're different things. _Bhoonidhi_ (https://bhoonidhi.nrsc.gov.in) is NRSC's dedicated data ordering/download portal for Resourcesat, Cartosat, RISAT etc. — this is where you'd get _Indian satellite imagery_ (LISS-III/IV, AWiFS) if you want an India-native sensor instead of Sentinel-2. Free registration, order-based download (not instant, but usually faster than the LULC shapefile MoU route). Worth trying in parallel since it directly satisfies "SRISHTI-DRISHTI platform" framing in your PS.

## Bhuvan LULC labels (for the Stage 2 fine-tune masks)

| Access                                                                | Link                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Thematic WMS/visualization                                            | https://bhuvan.nrsc.gov.in/gis/thematic/index.php                   |
| Registration (required for shapefile request)                         | https://bhuvan.nrsc.gov.in — "Register" link on homepage            |
| Shapefile/vector order (the one you actually need for training masks) | Same portal, under LULC thematic layer → request option after login |

As discussed — start this Day 1, treat it as enrichment not primary.

## SRISHTI-DRISHTI specifically (geo-tagged photos, watershed monitoring)

| Item                         | Link                                                                                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portal                       | https://bhuvan-app1.nrsc.gov.in/iwmp (IWMP/SRISHTI module)                                                                                                                                                                   |
| User manuals (English/Hindi) | Same domain, "Downloads" section — I found these referenced: bhuvan-app1.nrsc.gov.in/iwmp/downloads/Srishti-Drishti-Eng-USer_Manual.pdf                                                                                      |
| Access                       | This is watershed-project-specific — you'll likely need a specific project/district selected in the portal to pull real geo-tagged DRISHTI photos, since it's organized by IWMP/WDC-PMKSY project ID, not open bulk download |

Worth checking with your teammates handling the GIS/visualization side whether the hackathon organizers are providing a specific SRISHTI-DRISHTI dataset extract for this problem statement — PS-sponsored hackathons often bundle a pre-selected AOI + sample data package rather than expecting you to pull from the live portal cold. I'd check the hackathon's resource page/Discord/mail thread for that before spending Day 1 on portal registration.

## Backup labels if Bhuvan doesn't come through in time

Already covered earlier — ESA WorldCover (s3://esa-worldcover/, no registration) or Dynamic World via Earth Engine, both zero-wait and directly usable as your rasterize() target.
