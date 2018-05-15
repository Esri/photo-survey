from azure.cognitiveservices.vision.customvision.prediction import prediction_endpoint
from azure.cognitiveservices.vision.customvision.prediction.prediction_endpoint import models
from azure.cognitiveservices.vision.customvision.training.models import ImageUrlCreateEntry
from azure.cognitiveservices.vision.customvision.training import training_api
from arcgis.gis import GIS
from arcgis.features import FeatureLayer, Feature
import sys
import arcpy
import datetime as dt
import requests
import json

# TRAIN MODELS IF NEEDED*****************************************************************************************************
def imageListChunks(imgList,chunkSize):
    return [imgList[pos:pos + chunkSize] for pos in range(0, len(imgList), chunkSize)]
def imageList(tagName):
    resolveShortlink = requests.get("http://links.esri.com/localgovernment/photosurvey/images")
    resolveUrl = resolveShortlink.url
    comm_url = "{}/{}?ref=blight-detection".format(resolveUrl,tagName)
    response = requests.get(comm_url)
    imgList = json.loads(response.text)
    if response.status_code == 200:
        return [img['download_url'] for img in imgList]
    else:
        sys.exit(1)

fcURL = arcpy.GetParameterAsText(0)
categories = arcpy.GetParameterAsText(1)
trainingkey = arcpy.GetParameterAsText(2)

whereClause = "1=1"

trainer = training_api.TrainingApi(trainingkey)

categoryList = categories.split(";")

#Get Existing Project List from Azure:
existingProjects = [project.name for project in trainer.get_projects()]

# Create a new project
for name in categoryList:
    #If the project already exists than no new models will be created
    if name not in existingProjects:
        arcpy.AddMessage("Creating Model {}...".format(name))
        project = trainer.create_project(name)

        #Negative Tag Name
        negTagname = "Not_{}".format(name)

        #Make two tags in the new project
        positive_tag = trainer.create_tag(project.id, name)
        negative_tag = trainer.create_tag(project.id, negTagname)

        imageEntryList = [ImageUrlCreateEntry(url=image_url, tag_ids=[positive_tag.id]) for image_url in imageList(name)]
        negEntryList = [ImageUrlCreateEntry(url=image_url, tag_ids=[negative_tag.id]) for image_url in imageList(negTagname)]

        arcpy.AddMessage("Loading training photos into model...")
        for imgChunk in imageListChunks(imageEntryList, 63):
            trainer.create_images_from_urls(project.id,imgChunk)
        for imgChunk in imageListChunks(negEntryList, 63):
            trainer.create_images_from_urls(project.id,imgChunk)
        arcpy.AddMessage("Training Model...")
        iteration = trainer.train_project(project.id)
        while iteration.status == "Training":
            iteration = trainer.get_iteration(project.id, iteration.id)
            time.sleep(3)

        # The iteration is now trained. Make it the default project endpoint
        trainer.update_iteration(project.id, iteration.id, is_default=True)
        
        arcpy.AddMessage("Done!")
    else:
        arcpy.AddMessage("Loading '{}' model for blight detection...".format(name))

# PREDICT PHOTO****************************************************************************************
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

#Add Probability Score Fields

AITagFields = {
    "fields": []
}

exFieldList = [field.name for field in feature_layer.properties.fields]


fieldAdd = False
for category in categoryList:
    fieldName = (category + "_prb").lower()
    if fieldName not in exFieldList:
        fieldAdd = True
        fieldInfo = {
            "name": fieldName,
            "type": "esriFieldTypeDouble",
            "alias": category + " Probability",
            "nullable": True,
            "editable": True
        }
        AITagFields['fields'].append(fieldInfo)

if fieldAdd:
    try:
        feature_layer.manager.add_to_definition(AITagFields)
        arcpy.AddMessage("Adding Probability Score Fields...")
    except:
        e = sys.exc_info()[1]
        arcpy.AddError(e)
        customMessage = """
        Error adding blight probability field, check to see that you have permissions on the Feature Service.\n
        Ensure that you input layer was added to the map through portal and that you are logged in to the
        organization that the hosted feature service belongs to.\n
        """
        arcpy.AddError(customMessage)
        sys.exit(1)

#Acquire Prediction Key Programmatically
account = trainer.get_account_info()
predictionkey = account.keys.prediction_keys.primary_key

predictor = prediction_endpoint.PredictionEndpoint(predictionkey)

projectList = trainer.get_projects()

predictProjects = [{"projectID":project.id, "currentIteration":trainer.get_iterations(project.id)[-2].id, "name":project.name} for project in projectList if project.name in categoryList]

arcpy.SetProgressorLabel("Gathering Attachment URLs from Service")

# Get Attachment URLS
results = feature_layer.attachments.search(where=whereClause)
attachmentids = {}

for att in results:
    attachmentids[att['PARENTOBJECTID']] = []
for att in results:
    attachmentids[att['PARENTOBJECTID']].append(fcURL + "/{}/attachments/{}".format(att['PARENTOBJECTID'], att['ID']))

#Remove all attachments but the one in the middle of each house
for key, values in attachmentids.items():
    if values:
        midVal = values[int(len(values) / 2)]
        attachmentids[key] = midVal 

features = feature_layer.query(where=whereClause, return_geometry=False)
featuresDict = [feature for feature in features if feature.get_value(flOID) in attachmentids]
count = 0
arcpy.SetProgressor("step", "Analyzing Photos", 0, len(attachmentids) * len(predictProjects) ,1)
for key, value in sorted(attachmentids.items()):
    #url = feature_layer.url + '/{0}/attachments/{1}'.format(key, value)
    feature = featuresDict[count]
    count += 1
    for project in predictProjects:
        arcpy.SetProgressorLabel("Detecting Category '{}' in Feature {} of {}".format(project["name"],count,len(attachmentids)))
        while True:
            try:
                results = predictor.predict_image_url_with_no_store(project["projectID"], project["currentIteration"], url=value)
                break
            except arcpy.ExecuteError:
                print(arcpy.GetMessages())
            except:
                pass
        for prediction in results.predictions:
            if prediction.tag in categoryList:
                feature.set_value(prediction.tag.lower() + "_prb", prediction.probability * 100)
        arcpy.SetProgressorPosition()

    feature_layer.edit_features(updates=[feature])

    


