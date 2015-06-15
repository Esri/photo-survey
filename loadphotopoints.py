"""
	@author: bus
	@contact: cbuscaglia@esri.com
	@company: Esri
	@version: 1.0.0
	@description: Photo Survey Tool to load photos
	@requirements: Python 2.7.x or higher, ArcGIS 10.2, 10.3.x (also ArcGIS Pro)
	@copyright: Esri, 2015

"""
# Import modules

import arcpy
import math

# Script arguments (set in the GP tool)

PassengerPhotos = arcpy.GetParameterAsText(0)
DriverPhotos = arcpy.GetParameterAsText(1)
AngleField = arcpy.GetParameterAsText(2)
Geodatabase = arcpy.GetParameterAsText(3)
Parcels = arcpy.GetParameterAsText(4)
ParcelPIN = arcpy.GetParameterAsText(5)

arcpy.AddMessage("Step 1:  Loading input parameters")

# ______________________________________________________________________________#
#
# Convert Passenger Photos to Points
#_______________________________________________________________________________#

PhotoFeatureClass = """{}\\PointAttachmentsTemp""".format(Geodatabase)
arcpy.GeoTaggedPhotosToPoints_management(PassengerPhotos, PhotoFeatureClass, "", "ONLY_GEOTAGGED", "NO_ATTACHMENTS")

SR = arcpy.Describe(Parcels)
SRHelper = SR.spatialReference
PhotoFeatureClass2 = """{}\\PointAttachments""".format(Geodatabase)

arcpy.Project_management(PhotoFeatureClass, PhotoFeatureClass2, SRHelper)
arcpy.Delete_management(PhotoFeatureClass)

arcpy.AddMessage("Step 2:  Converting Photos to points")

# Load up the parcel dataset for the property association (and make a copy)

ParcelsFeatureClass = """{}\\Parcels""".format(Geodatabase)
arcpy.CopyFeatures_management(Parcels, ParcelsFeatureClass)

arcpy.AddMessage("Step 3:  Copying Parcels to staging geodatabase")

# Snap Passenger Photos to nearest parcel edge (30ft. default)

shape = arcpy.Describe(PhotoFeatureClass2).ShapeFieldName
fields = ['SHAPE@XY', AngleField]

def shift_photopoints(in_features, x_shift=None, y_shift=None):
	with arcpy.da.UpdateCursor(in_features, fields) as cursor:
		for row in cursor:
			x = row[0][0] + x_shift * math.cos(math.degrees(int(row[1])))
			y = row[0][1] + y_shift * math.sin(math.degrees(int(row[1])))
			row[0] = (x, y)
			cursor.updateRow(row)
	return


if AngleField:

	shift_photopoints(PhotoFeatureClass2, 15, 15)

else:

	pass

SnapHelper = """{} EDGE '30 Unknown'""".format(ParcelsFeatureClass)
arcpy.Snap_edit(PhotoFeatureClass2, SnapHelper)

Nearhelper = """{}\\NEAR""".format(Geodatabase)
NEAR = Nearhelper
arcpy.GenerateNearTable_analysis(PhotoFeatureClass2, ParcelsFeatureClass, NEAR,
								 "5 Feet", "NO_LOCATION", "NO_ANGLE", "CLOSEST", "0", "GEODESIC")

arcpy.AddMessage("Step 4:  Associating passenger photo points to nearest parcel")

arcpy.JoinField_management(NEAR, "NEAR_FID", ParcelsFeatureClass, "OBJECTID", ParcelPIN)

# Export non-matched Photos to table (no GPS, wrong attributes, etc.)

arcpy.JoinField_management(PhotoFeatureClass2, "OBJECTID", NEAR, "IN_FID")
arcpy.TableToTable_conversion(PhotoFeatureClass2, Geodatabase,
							  "NonMatchedPassengerPhotos", "{0} is Null".format(ParcelPIN), "")
arcpy.AddMessage("Step 5:  Reporting non-matched passenger photos to table")

# Delete non-matched photo points

whereclause = "{0} is Null".format(ParcelPIN)
with arcpy.da.UpdateCursor(PhotoFeatureClass2, ParcelPIN, whereclause) as cursor:
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
arcpy.GeoTaggedPhotosToPoints_management(DriverPhotos, PhotoFeatureClass, "", "ONLY_GEOTAGGED", "NO_ATTACHMENTS")

SR = arcpy.Describe(Parcels)
SRHelper = SR.spatialReference
PhotoFeatureClass3 = """{}\\PointAttachments2""".format(Geodatabase)

arcpy.Project_management(PhotoFeatureClass, PhotoFeatureClass3, SRHelper)
arcpy.Delete_management(PhotoFeatureClass)
arcpy.MakeFeatureLayer_management(ParcelsFeatureClass, "PARCELSFL")
arcpy.SelectLayerByLocation_management("PARCELSFL", "INTERSECT", PhotoFeatureClass2, "", "NEW_SELECTION", "INVERT")
arcpy.MakeFeatureLayer_management("PARCELSFL", "PARCELSFL2")

# Snap Driver Photos to nearest parcel edge (100 ft. default)

shape = arcpy.Describe(PhotoFeatureClass3).ShapeFieldName
fields = ['SHAPE@XY', AngleField]


def shift_photopoints(in_features, x_shift=None, y_shift=None):
	with arcpy.da.UpdateCursor(in_features, fields) as cursor:
		for row in cursor:
			x = row[0][0] + x_shift * math.cos(math.degrees(int(row[1])))
			y = row[0][1] + y_shift * math.sin(math.degrees(int(row[1])))
			row[0] = (x, y)
			cursor.updateRow(row)
	return


if AngleField:

	shift_photopoints(PhotoFeatureClass3, 15, 15)

else:

	pass

SnapHelper = """{} EDGE '100 Unknown'""".format("PARCELSFL2")
arcpy.Snap_edit(PhotoFeatureClass3, SnapHelper)

Nearhelper = """{}\\NEAR""".format(Geodatabase)
NEAR = Nearhelper
arcpy.GenerateNearTable_analysis(PhotoFeatureClass3, ParcelsFeatureClass, NEAR,
								 "5 Feet", "NO_LOCATION", "NO_ANGLE", "CLOSEST", "0", "GEODESIC")
arcpy.AddMessage("Step 6:  Associating driver photo points to nearest parcel")
arcpy.JoinField_management(NEAR, "NEAR_FID", ParcelsFeatureClass, "OBJECTID", ParcelPIN)

# Export non-matched Photos to table (no GPS, wrong attributes, etc.)

arcpy.JoinField_management(PhotoFeatureClass3, "OBJECTID", NEAR, "IN_FID")
arcpy.TableToTable_conversion(PhotoFeatureClass3, Geodatabase, "NonMatchedDriverPhotos",
							  "{0} is Null".format(ParcelPIN), "")
arcpy.AddMessage("Step 7:  Reporting non-matched driver photos to table")

# Delete non-matched photos

whereclause = "{0} is Null".format(ParcelPIN)
with arcpy.da.UpdateCursor(PhotoFeatureClass3, ParcelPIN, whereclause) as cursor:
	for row in cursor:
		cursor.deleteRow()

# Cleanup matched Photos (intermediate data)

arcpy.DeleteField_management(PhotoFeatureClass3, "IN_FID;NEAR_FID;NEAR_DIST")
arcpy.Delete_management(NEAR)
arcpy.AddField_management(PhotoFeatureClass2, "Path2", "TEXT", "", "", "150", "", "NULLABLE", "NON_REQUIRED", "")
arcpy.CalculateField_management(PhotoFeatureClass2, "Path2", "!Path!", "PYTHON", "")
arcpy.AddField_management(PhotoFeatureClass3, "Path2", "TEXT", "", "", "150", "", "NULLABLE", "NON_REQUIRED", "")
arcpy.CalculateField_management(PhotoFeatureClass3, "Path2", "!Path!", "PYTHON", "")
arcpy.DeleteField_management(PhotoFeatureClass2, "Path")
arcpy.DeleteField_management(PhotoFeatureClass3, "Path")

arcpy.Append_management(PhotoFeatureClass2, PhotoFeatureClass3, "TEST", "", "")

#Create Photo Attachments

ParcelPointHelper = """{}\\ParcelPoints""".format(Geodatabase)
arcpy.FeatureToPoint_management(ParcelsFeatureClass, ParcelPointHelper, "INSIDE")
arcpy.EnableAttachments_management(ParcelPointHelper)
arcpy.AddAttachments_management(ParcelPointHelper, ParcelPIN, PhotoFeatureClass3, ParcelPIN, "Path2", "")
arcpy.AddMessage("Step 8:  Creating photo attachments")

#______________________________________________________________________________#
#
# Cleanup Staging GeoDatabase
#______________________________________________________________________________#

arcpy.Delete_management(PhotoFeatureClass2)
arcpy.Delete_management(PhotoFeatureClass3)
arcpy.Delete_management(ParcelsFeatureClass)
arcpy.DeleteField_management(ParcelPointHelper, "ORIG_FID")
arcpy.AddMessage("Step 9:  Cleaning up staging geodatabase")

#______________________________________________________________________________#
#
# Adding Survey Fields
#______________________________________________________________________________#

arcpy.AddMessage("Step 10: Adding survey questions")
arcpy.CreateDomain_management(Geodatabase, "YesNoMaybe", "YesNoMaybe", "TEXT", "CODED")
DomainDict1 = {"Yes": "Yes", "No": "No", "Maybe": "Maybe"}
for code in DomainDict1:
	arcpy.AddCodedValueToDomain_management(Geodatabase, "YesNoMaybe", code, DomainDict1[code])

arcpy.CreateDomain_management(Geodatabase, "FoundationType", "FoundationType", "TEXT", "CODED")
DomainDict2 = {"Crawlspace": "Crawlspace", "Raised": "Raised", "Elevated": "Elevated", "Slab on Grade": "Slab on Grade"}
for codex in DomainDict2:
	arcpy.AddCodedValueToDomain_management(Geodatabase, "FoundationType", codex, DomainDict2[codex])

arcpy.AddField_management(ParcelPointHelper, "STRUCT", "TEXT", "", "", "5", "Structure", "NULLABLE", "REQUIRED", "")
arcpy.AssignDomainToField_management(ParcelPointHelper, "STRUCT", "YesNoMaybe")

arcpy.AddField_management(ParcelPointHelper, "OVERGROWTH", "TEXT", "", "", "5", "Overgrown Lot", "NULLABLE", "REQUIRED", "")
arcpy.AssignDomainToField_management(ParcelPointHelper, "OVERGROWTH", "YesNoMaybe")

arcpy.AddField_management(ParcelPointHelper, "FOUNDTYPE", "TEXT", "", "", "25", "Foundation Type", "NULLABLE", "NON_REQUIRED", "")
arcpy.AssignDomainToField_management(ParcelPointHelper, "FOUNDTYPE", "FoundationType")

arcpy.AddField_management(ParcelPointHelper, "RFDMG", "TEXT", "", "", "5", "Roof Damage", "NULLABLE", "NON_REQUIRED", "")
arcpy.AssignDomainToField_management(ParcelPointHelper, "RFDMG", "YesNoMaybe")

arcpy.AddField_management(ParcelPointHelper, "EXTDMG", "TEXT", "", "", "5", "Exterior Damage", "NULLABLE", "NON_REQUIRED", "")
arcpy.AssignDomainToField_management(ParcelPointHelper, "EXTDMG", "YesNoMaybe")

arcpy.AddField_management(ParcelPointHelper, "GRAFDMG", "TEXT", "", "", "5", "Graffiti Damage", "NULLABLE", "NON_REQUIRED", "")
arcpy.AssignDomainToField_management(ParcelPointHelper, "GRAFDMG", "YesNoMaybe")

arcpy.AddField_management(ParcelPointHelper, "BOARDED", "TEXT", "", "", "5", "Boarded", "NULLABLE", "NON_REQUIRED", "")
arcpy.AssignDomainToField_management(ParcelPointHelper, "BOARDED", "YesNoMaybe")

arcpy.AddMessage("Step 11: Adding application fields")
arcpy.CreateDomain_management(Geodatabase, "YesNo", "YesNo", "TEXT", "CODED")
DomainDict3 = {"Yes": "Yes", "No": "No"}
for codev in DomainDict3:
	arcpy.AddCodedValueToDomain_management(Geodatabase, "YesNo", codev, DomainDict3[codev])

arcpy.AddField_management(ParcelPointHelper, "BSTPHOTOID", "TEXT", "", "", "5", "Best Photo Identifier", "NULLABLE", "NON_REQUIRED", "")
arcpy.AssignDomainToField_management(ParcelPointHelper, "BSTPHOTOID", "YesNo")
arcpy.AddField_management(ParcelPointHelper, "SRVNAME", "TEXT", "", "", "25", "Surveyor Name", "NULLABLE", "NON_REQUIRED", "")
# Commented out to change this to be the surveyor field instead of a boolean
# arcpy.AssignDomainToField_management(ParcelPointHelper, "Surveyed", "YesNo")
arcpy.AddMessage("Step 12: Finalizing photo survey feature class")













