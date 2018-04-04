from azure.cognitiveservices.vision.customvision.prediction import prediction_endpoint
from azure.cognitiveservices.vision.customvision.prediction.prediction_endpoint import models
from azure.cognitiveservices.vision.customvision.training import training_api
from arcgis.gis import GIS
from arcgis.features import FeatureLayer, Feature
import sys
import arcpy
import datetime as dt
import requests

fcURL = arcpy.GetParameterAsText(0)
categories = arcpy.GetParameterAsText(1)
trainingkey = arcpy.GetParameterAsText(2)
predictionkey = arcpy.GetParameterAsText(3)
whereClause = "1=1"

if not fcURL.startswith('http'):
    desc = arcpy.Describe(fcURL)
    url = desc.path

    whereClause = desc.whereClause if desc.whereClause else "1=1" 

    try:
        layer_id = int(desc.name)
    except:
        name = desc.name[1:]
        layer_id = ''
        for c in name:
            if c in ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']:
                layer_id += c
            else:
                break
        layer_id = int(layer_id)
    fcURL = url + "/{}".format(str(layer_id))


target = GIS("pro")
feature_layer = FeatureLayer(fcURL, target)
flOID = arcpy.Describe(fcURL).OIDFieldName


#Add AI Tag Field to feature class

AITagFields = {
    "fields": []
}

categoryList = categories.split(";")
exFieldList = [field.name for field in arcpy.ListFields(fcURL)]



for category in categoryList:
    fieldName = category + "_prb"
    if fieldName not in exFieldList and fieldName.lower() not in exFieldList:
        fieldInfo = {
            "name": category.lower() + "_prb",
            "type": "esriFieldTypeDouble",
            "alias": category + " Probability",
            "nullable": True,
            "editable": True
        }
        AITagFields['fields'].append(fieldInfo)

        try:
            feature_layer.manager.add_to_definition(AITagFields)
            arcpy.AddMessage("Adding AI Tag Fields")
        except:
            e = sys.exc_info()[1]
            arcpy.AddError(e)
            arcpy.AddError("Error adding blight probability field, check to see that you have permissions on the Feature Service")
            sys.exit(1)

# for category in categoryList:
#     fieldName = category + "_prb"
#     if fieldName not in exFieldList and fieldName.lower() not in exFieldList:
#         arcpy.AddField_management(fcURL,category + "_prb", field_type = "DOUBLE", field_alias=category + " Probability")

trainer = training_api.TrainingApi(trainingkey)
predictor = prediction_endpoint.PredictionEndpoint(predictionkey)

projectList = trainer.get_projects()

# for project in projectList:
#     arcpy.AddMessage("Project: " + project.name)
#     arcpy.AddMessage("Project ID: " + project.id)
#     tags = trainer.get_tags(project.id)
#     arcpy.AddMessage("****Project Tags****")
#     for tag in tags.tags:
#         arcpy.AddMessage("Tag Name: " + tag.name)
#         arcpy.AddMessage("Tag ID: " + tag.id)

predictProjects = [{"projectID":project.id, "currentIteration":trainer.get_iterations(project.id)[-2].id, "name":project.name} for project in projectList if project.name in categoryList]
# arcpy.AddMessage(predictProjects)
# for project in predictProjects:
#     arcpy.AddMessage("Project: " + project["name"])
#     arcpy.AddMessage("Project ID: " + project["projectID"])
#     arcpy.AddMessage("Project Iter: " + project["currentIteration"])
#     tags = trainer.get_tags(project["projectID"], project["currentIteration"])
#     arcpy.AddMessage("****Project Tags****")
#     for tag in tags.tags:
#         imageList = trainer.get_tagged_images(project["projectID"],project["currentIteration"],[tag.id], take=250)
#         for num,image in enumerate(imageList):
#             img_data = requests.get(image.image_uri).content
#             with open(r'C:\Projects\photo-survey-ai\Photos\{}{}.jpg'.format(tag.name,num), 'wb') as imagestream:
#                 imagestream.write(img_data)
#             arcpy.AddMessage(image.image_uri)
#         arcpy.AddMessage("Tag Name: " + tag.name)
#         arcpy.AddMessage("Tag ID: " + tag.id)

features = feature_layer.query(where=whereClause, return_ids_only=True)
id_list = features['objectIds']

attachmentids = {}
progCount = 0
arcpy.SetProgressor("step", "Gathering Attachment URLs from Service", 0, len(id_list), 1)
for ids in id_list:
    attachmentlist = feature_layer.attachments.get_list(oid=ids)
    attachmentids[ids] = [x['id'] for x in attachmentlist]
    arcpy.SetProgressorPosition()

#Remove items from dictionary if there is No Attachments for that feature
attachmentids = {key: value for key, value in attachmentids.items() if value != []}

tagIds = ""
#Remove all the photos but the one in the middle of each house
for ids, values in attachmentids.items():
    if values:
        midVal = values[int(len(values) / 2)]
        attachmentids[ids] = midVal
        tagIds += str(ids) + ","
#arcpy.AddMessage(attachmentids)

# arcpy.SetProgressorLabel("Gathering Attachment URLs from Service")
# # Upcoming attachment service search update change
# results = feature_layer.attachments.search(where=whereClause)
# attachmentids = {}

# for att in results:
#     attachmentids[att['PARENTOBJECTID']] = []
# for att in results:
#     attachmentids[att['PARENTOBJECTID']].append(fcURL + "/{}/attachments/{}".format(att['PARENTOBJECTID'], att['ID']))

# #Remove all attachments but the one in the middle of each house
# for key, values in attachmentids.items():
#     if values:
#         midVal = values[int(len(values) / 2)]
#         attachmentids[key] = midVal 

features = feature_layer.query(where=whereClause, return_geometry=False)
featuresDict = [feature for feature in features if feature.get_value(flOID) in attachmentids]
count = 0
arcpy.SetProgressor("step", "Analyzing Photos", 0, len(attachmentids) * len(predictProjects) ,1)
for key, value in sorted(attachmentids.items()):
    url = feature_layer.url + '/{0}/attachments/{1}'.format(key, value)
    #arcpy.AddMessage(url)
    feature = featuresDict[count]
    count += 1
    #whereQuery = "{} = {}".format(flOID, key)
    #features = feature_layer.query(where=whereQuery)
    #feature = [feature for feature in features][0]
    for project in predictProjects:
        arcpy.SetProgressorLabel("Analyzing Photos: Detecting Category '{}' in Feature {} of {}".format(project["name"],count,len(attachmentids)))
        #while True:
        try:
            #startTime = dt.datetime.now()
            results = predictor.predict_image_url(project["projectID"], project["currentIteration"], url=url)
            #seconds = dt.datetime.now() - startTime
            #arcpy.AddMessage("Prediction Time: "  + str(seconds.microseconds))
            #break
        except arcpy.ExecuteError:
            print(arcpy.GetMessages())
        except:
            pass
        for prediction in results.predictions:
            if prediction.tag in categoryList:
                #arcpy.AddMessage("\t" + prediction.tag + ": {0:.2f}%".format(prediction.probability * 100))
                feature.set_value(prediction.tag.lower() + "_prb", prediction.probability * 100)
        arcpy.SetProgressorPosition()
    #startTime = dt.datetime.now()
    #arcpy.AddMessage(feature)
    feature_layer.edit_features(updates=[feature])
    #arcpy.AddMessage(results)
    #seconds = dt.datetime.now() - startTime
    #arcpy.AddMessage("Update Time: "  + str(seconds.microseconds))

    


