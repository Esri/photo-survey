# Detect Photo Category Test Mode

For testing and developing new detection categories in the "Detect Photo Category" tool a "test mode" can be enabled

Follow these steps:

1. Upload test images to folders inside the [Training Photos](/esri/photo-survey/tree/blight-images-dev/Training Photos) folder in the the blight-images-dev branch. Example: If the new category to detect was brick siding, put positive images in a folder called "Brick" and negative images in a folder called "Not_Brick".

2. In the Detect Category Tool, access the properties and change the Category parameter's label property from "Category" to "Category dev". This will cause the tool to point at the blight-images-dev branch for its photo detection categories
