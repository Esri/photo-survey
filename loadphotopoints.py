"""
    @author: bus
    @contact: cbuscaglia@esri.com
    @company: Esri
    @version: 1.0.0
    @description: Photo Survey Tool to load photos
    @requirements: Python 2.7.x, ArcGIS 10.2, 10.3, 10.3.1
    @copyright: Esri, 2015

"""

# Import modules

import arcpy
import math

# Script arguments (set in the GP tool)

PassengerPhotos =       arcpy.GetParameterAsText(0)
DriverPhotos =          arcpy.GetParameterAsText(1)
##AngleField =            arcpy.GetParameterAsText(2)
Geodatabase =           arcpy.GetParameterAsText(2)
Parcels =               arcpy.GetParameterAsText(3)
ParcelPIN =             arcpy.GetParameterAsText(4)

arcpy.AddMessage("Step 1: Loading input parameters")

#______________________________________________________________________________#
#
# Convert Passenger Photos to Points
#______________________________________________________________________________#

PhotoFeatureClass = """{}\\PointAttachmentsTemp""".format(Geodatabase)
arcpy.GeoTaggedPhotosToPoints_management (PassengerPhotos, PhotoFeatureClass,"",
"ONLY_GEOTAGGED","NO_ATTACHMENTS")

SR = arcpy.Describe(Parcels)
SRHelper = SR.spatialReference
PhotoFeatureClass2 = """{}\\PointAttachments""".format(Geodatabase)

arcpy.Project_management(PhotoFeatureClass, PhotoFeatureClass2, SRHelper)
arcpy.Delete_management(PhotoFeatureClass)

arcpy.AddMessage("Step 2: Converting Photos to points")

# Load up the parcel dataset for the property association (and make a copy)

ParcelsFeatureClass = """{}\\Parcels""".format(Geodatabase)
arcpy.CopyFeatures_management(Parcels, ParcelsFeatureClass)

arcpy.AddMessage("Step 3: Copying Parcels to staging geodatabase")

# Snap Passenger Photos to nearest parcel edge (30ft. default)

SnapHelper = """{} EDGE '30 Unknown'""".format(ParcelsFeatureClass)
arcpy.Snap_edit(PhotoFeatureClass2, SnapHelper)

Nearhelper = """{}\\NEAR""".format(Geodatabase)
NEAR = Nearhelper
arcpy.GenerateNearTable_analysis(PhotoFeatureClass2, ParcelsFeatureClass, NEAR,
"5 Feet", "NO_LOCATION", "NO_ANGLE", "CLOSEST", "0", "GEODESIC")

arcpy.AddMessage("Step 4: Associating passenger photo points to nearest parcel")

arcpy.JoinField_management(NEAR, "NEAR_FID", ParcelsFeatureClass, "OBJECTID",
ParcelPIN)

# Export non-matched Photos to table (no GPS, wrong attributes, etc.)

arcpy.JoinField_management(PhotoFeatureClass2, "OBJECTID", NEAR, "IN_FID")
arcpy.TableToTable_conversion(PhotoFeatureClass2, Geodatabase,
"NonMatchedPassengerPhotos",
"PIN is Null","")

arcpy.AddMessage("Step 5: Reporting non-matched passenger photos to table")

# Delete non-matched photo points

whereclause = "PIN is Null"
with arcpy.da.UpdateCursor(PhotoFeatureClass2, "PIN", whereclause) as cursor:
    for row in cursor:
        cursor.deleteRow()

# Cleanup matched Photos (intermediate data)

arcpy.DeleteField_management(PhotoFeatureClass2, "IN_FID;NEAR_FID;NEAR_DIST")
arcpy.Delete_management(NEAR)

#______________________________________________________________________________#
#
# Convert Driver Photos to Points
#______________________________________________________________________________#

PhotoFeatureClass = """{}\\PointAttachmentsTemp""".format(Geodatabase)
arcpy.GeoTaggedPhotosToPoints_management (DriverPhotos, PhotoFeatureClass,"",
"ONLY_GEOTAGGED","NO_ATTACHMENTS")

SR = arcpy.Describe(Parcels)
SRHelper = SR.spatialReference
PhotoFeatureClass3 = """{}\\PointAttachments2""".format(Geodatabase)

arcpy.Project_management(PhotoFeatureClass, PhotoFeatureClass3, SRHelper)
arcpy.Delete_management(PhotoFeatureClass)
arcpy.MakeFeatureLayer_management(ParcelsFeatureClass, "PARCELSFL")
arcpy.SelectLayerByLocation_management("PARCELSFL", "INTERSECT",
PhotoFeatureClass2, "", "NEW_SELECTION", "INVERT")
arcpy.MakeFeatureLayer_management("PARCELSFL", "PARCELSFL2")

# Snap Passenger Photos to nearest parcel edge (100 ft. default)

SnapHelper = """{} EDGE '100 Unknown'""".format("PARCELSFL2")
arcpy.Snap_edit(PhotoFeatureClass3, SnapHelper)

Nearhelper = """{}\\NEAR""".format(Geodatabase)
NEAR = Nearhelper
arcpy.GenerateNearTable_analysis(PhotoFeatureClass3, ParcelsFeatureClass, NEAR,
"5 Feet", "NO_LOCATION", "NO_ANGLE", "CLOSEST", "0", "GEODESIC")

arcpy.AddMessage("Step 6: Associating driver photo points to nearest parcel")

arcpy.JoinField_management(NEAR, "NEAR_FID", ParcelsFeatureClass, "OBJECTID",
ParcelPIN)

# Export non-matched Photos to table (no GPS, wrong attributes, etc.)

arcpy.JoinField_management(PhotoFeatureClass3, "OBJECTID", NEAR, "IN_FID")
arcpy.TableToTable_conversion(PhotoFeatureClass3, Geodatabase,
"NonMatchedDriverPhotos", "PIN is Null","")

arcpy.AddMessage("Step 7: Reporting non-matched driver photos to table")

# Delete non-matched photos

whereclause = "PIN is Null"
with arcpy.da.UpdateCursor(PhotoFeatureClass3, "PIN", whereclause) as cursor:
    for row in cursor:
        cursor.deleteRow()

# Cleanup matched Photos (intermediate data)

arcpy.DeleteField_management(PhotoFeatureClass3, "IN_FID;NEAR_FID;NEAR_DIST")
arcpy.Delete_management(NEAR)

arcpy.Append_management(PhotoFeatureClass2, PhotoFeatureClass3, "TEST", "", "")

#Create Photo Attachments

ParcelPointHelper = """{}\\ParcelPoints""".format(Geodatabase)
arcpy.FeatureToPoint_management(ParcelsFeatureClass, ParcelPointHelper,"INSIDE")
arcpy.EnableAttachments_management(ParcelPointHelper)
arcpy.AddAttachments_management(ParcelPointHelper, "PIN", PhotoFeatureClass3,
"PIN", "Path", "")

arcpy.AddMessage ("Step 8: Creating photo attachments")

#______________________________________________________________________________#
#
# Cleanup Staging GeoDatabase
#______________________________________________________________________________#

arcpy.Delete_management (PhotoFeatureClass2)
arcpy.Delete_management (PhotoFeatureClass3)
arcpy.Delete_management (ParcelsFeatureClass)

arcpy.AddMessage ("Step 9: Cleaning up staging geodatabase")
arcpy.AddMessage ("Step 10: Finalizing photo survey feature class")












