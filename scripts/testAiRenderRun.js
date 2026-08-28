// services/aiRender/workflowRegistry.ts
var RAW_WORKFLOWS = {
  1: {
    id: 1,
    slug: "text-to-render",
    name: "Text to Render",
    description: "Create photorealistic renders from text prompts or reference images.",
    input_types: ["text", "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3-pro-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "TASK: Create a photorealistic architectural visualization.\nPROJECT: {{project_type}}\nSCENE: {{space_type}}\nDESIGN DIRECTION: {{architectural_style}} {{interior_style}}\nDESIGN DESCRIPTION: {{design_intent}}\nMATERIAL PALETTE: {{materials}}\nCOLOR PALETTE: {{colors}}\nFURNITURE: {{furniture}}\nLIGHTING: {{lighting}}\nTIME OF DAY: {{time_of_day}}\nCAMERA: {{camera_angle}} {{lens}} {{composition}}\nENVIRONMENT: {{location_context}} {{landscape}}\nPEOPLE: {{people}}\nMOOD: {{mood}}\nUSER REQUIREMENTS: {{custom_instruction}}\n{{UNIVERSAL_QUALITY_BLOCK}}\nDo not create warped architecture, distorted furniture, floating objects, random text, logos or watermarks.",
    required_fields: ["user_input"],
    optional_fields: ["style", "materials", "colors", "camera_angle", "lighting", "mood", "people", "landscape", "custom_instruction"],
    default_values: {},
    estimated_time: "10-35 sec (Pro) / 4-12 sec (Flash)",
    async: false,
    manual_test_criteria: "Pass when: Prompt adherence >= 4/5, Photorealism >= 4/5, Architectural plausibility >= 4/5, Material realism >= 4/5, Composition/camera quality >= 4/5, No major AI artifacts.",
    prompt_version: "text_to_render:v1"
  },
  2: {
    id: 2,
    slug: "sketch-to-render",
    name: "Sketch to Render",
    description: "Convert architectural sketches into photorealistic renders.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "controlnet_gpu",
    default_model: "flux-2-pro",
    allowed_models: ["flux-2-pro", "stable-diffusion-xl"],
    model_dropdown: true,
    prompt_template: "TASK: Convert the supplied architectural sketch into a photorealistic architectural visualization.\nSTRUCTURAL PRIORITY: Treat sketch lines as authoritative design geometry. Preserve: building massing, roof form, major edges, fa\xE7ade divisions, openings, doors, windows, floor levels, primary perspective.\nDESIGN STYLE: {{style}}\nMATERIALS: {{materials}}\nDESIGN DETAILS: {{design_intent}}\nENVIRONMENT: {{environment}}\nLANDSCAPE: {{landscape}}\nLIGHTING: {{lighting}}\nMaintain the perspective implied by the source sketch.\nUSER REQUIREMENTS: {{custom_instruction}}\n{{UNIVERSAL_QUALITY_BLOCK}}",
    required_fields: ["source_image"],
    optional_fields: ["style", "materials", "lighting", "environment", "landscape", "custom_instruction"],
    default_values: { controlnet_type: "scribble", controlnet_conditioning_scale: 0.8 },
    estimated_time: "15-45 sec (Warm) / 45-120 sec (Cold)",
    async: true,
    manual_test_criteria: "Sketch geometry preservation >= 4/5, Window/door correspondence >= 90% visually, Perspective preservation >= 4/5, Photorealism >= 4/5, Material adherence >= 4/5, No major added/removed structural elements.",
    prompt_version: "sketch_to_render:v1"
  },
  3: {
    id: 3,
    slug: "elevation-to-render",
    name: "Elevation to Render",
    description: "Convert architectural elevations into realistic fa\xE7ade renders.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "controlnet_gpu",
    default_model: "stable-diffusion-xl",
    allowed_models: ["stable-diffusion-xl"],
    model_dropdown: false,
    prompt_template: "TASK: Convert the supplied architectural elevation into a realistic architectural fa\xE7ade visualization.\nELEVATION AUTHORITY: Preserve fa\xE7ade proportions, floor heights, roofline, windows, doors, balconies and structural grid. Do not reposition architectural openings.\nMATERIALS: {{materials}}\nSTYLE: {{architectural_style}}\nGLAZING: {{glazing}}\nLANDSCAPE: {{landscape}}\nLIGHTING: {{lighting}}\nENVIRONMENT: {{environment}}\nUSER REQUIREMENTS: {{custom_instruction}}\nCreate realistic fa\xE7ade depth, material joints, glazing reflections and recess shadows while maintaining source geometry.",
    required_fields: ["source_image"],
    optional_fields: ["materials", "architectural_style", "glazing", "landscape", "lighting", "environment", "custom_instruction"],
    default_values: { controlnet_type: "lineart", controlnet_conditioning_scale: 0.9 },
    estimated_time: "20-60 sec (Warm) / 60-120 sec (Cold)",
    async: true,
    manual_test_criteria: "Opening location match >= 95%, Floor-height/massing match >= 4/5, Fa\xE7ade material quality >= 4/5, No unrequested geometry change, Overall photorealism >= 4/5.",
    prompt_version: "elevation_to_render:v1"
  },
  4: {
    id: 4,
    slug: "three-d-model-to-render",
    name: "3D Model to Render",
    description: "Convert 3D model views into photorealistic renders.",
    input_types: ["image/png"],
    // expects depth pass image
    output_types: ["image/png"],
    provider: "controlnet_gpu",
    default_model: "stable-diffusion-xl",
    allowed_models: ["stable-diffusion-xl"],
    model_dropdown: false,
    prompt_template: "TASK: Transform the supplied depth/geometry reference into a photorealistic architectural rendering.\nGEOMETRY AUTHORITY: Preserve scene geometry, massing, camera, floor levels and primary openings.\nSTYLE: {{style}}\nMATERIALS: {{materials}}\nFURNITURE: {{furniture}}\nLANDSCAPE: {{landscape}}\nLIGHTING: {{lighting}}\nATMOSPHERE: {{mood}}\nUSER REQUIREMENTS: {{custom_instruction}}\nApply physically believable materials and lighting while respecting supplied geometry.",
    required_fields: ["source_image"],
    // depth pass input
    optional_fields: ["style", "materials", "furniture", "landscape", "lighting", "mood", "custom_instruction"],
    default_values: { controlnet_type: "depth", controlnet_conditioning_scale: 0.75 },
    estimated_time: "20-60 sec (Warm) / 60-120 sec (Cold)",
    async: true,
    manual_test_criteria: "3D silhouette preservation >= 95%, Camera match >= 4/5, Depth/occlusion correctness >= 4/5, Materials >= 4/5, Photorealism >= 4/5, No major geometry hallucination.",
    prompt_version: "3d_model_to_render:v1"
  },
  5: {
    id: 5,
    slug: "image-to-render",
    name: "Image to Render",
    description: "Transform an existing image into a photorealistic architectural render.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3.1-flash-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "TASK: Transform the supplied image into a professional photorealistic architectural visualization.\n{{SOURCE_IMAGE_AUTHORITY}}\nImprove: materials, lighting, textures, reflections, shadows, atmospheric depth, photographic finish.\nTARGET STYLE: {{style}}\nMATERIAL CHANGES: {{materials}}\nLIGHTING: {{lighting}}\nREQUESTED CHANGES: {{requested_changes}}\nUSER REQUIREMENTS: {{custom_instruction}}\n{{UNIVERSAL_QUALITY_BLOCK}}",
    required_fields: ["source_image"],
    optional_fields: ["style", "materials", "lighting", "requested_changes", "custom_instruction"],
    default_values: {},
    estimated_time: "6-18 sec (Recommended)",
    async: false,
    manual_test_criteria: "Original geometry preservation >= 4/5, Camera preservation >= 4/5, Visual-quality improvement clearly noticeable, Prompt adherence >= 4/5, No unrelated redesign, Photorealism >= 4/5.",
    prompt_version: "image_to_render:v1"
  },
  6: {
    id: 6,
    slug: "floor-plan-to-render",
    name: "Floor Plan to Render",
    description: "Convert a floor plan into a rendered/furnished visualization.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "controlnet_gpu",
    default_model: "flux-2-pro",
    allowed_models: ["flux-2-pro", "stable-diffusion-xl"],
    model_dropdown: false,
    prompt_template: "TASK: Convert the supplied architectural floor plan into a furnished top-down architectural visualization.\nPLAN AUTHORITY: Preserve external walls, internal partitions, doors, windows, room boundaries, circulation and relative room proportions.\nROOM FUNCTIONS: {{room_labels}}\nSTYLE: {{style}}\nFLOOR MATERIALS: {{floor_materials}}\nFURNITURE: {{furniture}}\nCOLORS: {{colors}}\nUSER REQUIREMENTS: {{custom_instruction}}\nProduce a clean orthographic top-down visualization.",
    required_fields: ["source_image"],
    optional_fields: ["room_labels", "style", "floor_materials", "furniture", "colors", "custom_instruction"],
    default_values: { controlnet_type: "segment", controlnet_conditioning_scale: 0.8 },
    estimated_time: "30-90 sec (Warm) / 60-150 sec (Cold)",
    async: true,
    manual_test_criteria: "Wall layout match >= 95%, Door/window consistency >= 90%, Room-function correctness >= 90%, Furniture scale/circulation >= 4/5, No major plan alteration, Rendering quality >= 4/5.",
    prompt_version: "floorplan_to_render:v1"
  },
  7: {
    id: 7,
    slug: "render-to-moodboard",
    name: "Render to Moodboard",
    description: "Extract the design language of a render and create a moodboard.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    // returns the composed moodboard / swatches
    provider: "gemini_analysis",
    // uses Stage 1: gemini-2.5-flash -> Stage 2: gemini-3.1-flash-image
    default_model: "gemini-2.5-flash",
    allowed_models: ["gemini-2.5-flash"],
    model_dropdown: false,
    prompt_template: "Analyze the supplied architectural render. Return structured JSON containing: design style, primary color hex codes, woods, stones, metals, fabrics, flooring, wall finishes, furniture style, lighting style, decorative elements, design keywords.",
    required_fields: ["source_image"],
    optional_fields: [],
    default_values: {},
    estimated_time: "30-90 sec (requires swatch generation)",
    async: true,
    manual_test_criteria: "Extracted palette resemblance >= 4/5, Material identification accuracy >= 4/5, Swatches visually correspond to source >= 4/5, Moodboard design coherence >= 4/5, No unrelated style invention.",
    prompt_version: "render_to_moodboard:v1"
  },
  8: {
    id: 8,
    slug: "render-variation",
    name: "Render Variation",
    description: "Generate alternative design variations of an existing render.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3.1-flash-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "TASK: Create a design variation of the supplied architectural render.\nSTRUCTURAL LOCK: Preserve camera, perspective, architecture, openings and spatial layout.\nCHANGE ONLY: {{variation_scope}}\nTARGET STYLE: {{style}}\nMATERIALS: {{materials}}\nCOLORS: {{colors}}\nFURNITURE: {{furniture}}\nUSER REQUIREMENTS: {{custom_instruction}}\nTHE OUTPUT MUST REMAIN RECOGNIZABLY THE SAME PROJECT FROM THE SAME VIEWPOINT.",
    required_fields: ["source_image"],
    optional_fields: ["variation_scope", "style", "materials", "colors", "furniture", "custom_instruction"],
    default_values: {},
    estimated_time: "6-18 sec",
    async: false,
    manual_test_criteria: "Same-project recognition >= 4/5, Camera preservation >= 4/5, Requested variation clearly visible, Unrequested changes minimal, Overall quality >= 4/5.",
    prompt_version: "render_variation:v1"
  },
  9: {
    id: 9,
    slug: "edit-canvas",
    name: "Edit Canvas",
    description: "Select areas and make localized AI edits.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3-pro-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "TASK: Edit only the selected target region.\nREQUESTED EDIT: {{edit_instruction}}\nRestrict modification to the selected target. Preserve everything unrelated to the request. Match the existing scale, perspective, lighting, shadows, reflections and photographic character. Do not redesign surrounding areas.",
    required_fields: ["source_image", "mask"],
    optional_fields: ["edit_instruction"],
    default_values: {},
    estimated_time: "10-35 sec",
    async: false,
    manual_test_criteria: "Edit contained inside intended area >= 4/5, Boundary blending >= 4/5, Requested edit accuracy >= 4/5, Protected-area preservation >= 95%, No visible seams/ghosting.",
    prompt_version: "edit_canvas:v1"
  },
  10: {
    id: 10,
    slug: "conversational-edit",
    name: "Conversational Edit",
    description: "Edit an image through natural-language conversation.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3-pro-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "You are an architectural image-editing engine. Each instruction modifies the current image state. For localized requests: modify only relevant objects, preserve architecture, preserve camera, preserve unrelated elements, maintain realistic scale and lighting, preserve previous accepted edits unless explicitly reversed.",
    required_fields: ["source_image", "user_input"],
    optional_fields: ["conversation_history"],
    default_values: {},
    estimated_time: "15-45 sec",
    async: false,
    manual_test_criteria: "Target-object identification >= 90%, Turn-to-turn edit memory >= 4/5, Previous accepted edits preserved, Locality of changes >= 4/5, Final realism >= 4/5.",
    prompt_version: "conversational_edit:v1"
  },
  11: {
    id: 11,
    slug: "select-and-modify",
    name: "Select and Modify",
    description: "Select a specific object/surface and modify it.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3-pro-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "TARGET: {{identified_object}}\nREQUESTED MODIFICATION: {{modification}}\nModify only the selected object. Preserve its position and physically appropriate scale unless requested otherwise. Match perspective, lighting, shadows and reflections. Everything outside the target should remain unchanged.",
    required_fields: ["source_image", "mask"],
    optional_fields: ["identified_object", "modification"],
    default_values: {},
    estimated_time: "10-35 sec",
    async: false,
    manual_test_criteria: "Correct selected object >= 95%, Edit spill outside target minimal, Requested change >= 4/5, Lighting integration >= 4/5, Scene preservation >= 4/5.",
    prompt_version: "select_and_modify:v1"
  },
  12: {
    id: 12,
    slug: "annotate-image",
    name: "Annotate Image",
    description: "Add structured architectural/design annotations.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["text/json"],
    provider: "gemini_analysis",
    default_model: "gemini-2.5-flash",
    allowed_models: ["gemini-2.5-flash"],
    model_dropdown: false,
    prompt_template: "Identify significant architectural/interior-design elements. For each object return: id category label description bounding box confidence. Use normalized bounding boxes: [ymin, xmin, ymax, xmax]. Return valid JSON only.",
    required_fields: ["source_image"],
    optional_fields: [],
    default_values: {},
    estimated_time: "2-8 sec",
    async: false,
    manual_test_criteria: "Object identification precision >= 90%, Bounding-box placement visually correct >= 90%, Labels meaningful >= 4/5, No hallucinated major objects, Frontend annotations align with image.",
    prompt_version: "annotate_image:v1"
  },
  13: {
    id: 13,
    slug: "remove-object",
    name: "Remove Object",
    description: "Remove a selected object and reconstruct its background.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3-pro-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "Remove only: {{target_object}}\nReconstruct the hidden background in a physically plausible way. Continue surrounding wall, floor, ceiling, materials, architecture, lighting and reflections. The result should appear as if the object never existed. Do not add a replacement object. Do not modify unrelated scene elements.",
    required_fields: ["source_image", "mask"],
    optional_fields: ["target_object"],
    default_values: {},
    estimated_time: "10-35 sec",
    async: false,
    manual_test_criteria: "Object fully removed, No ghosting, Background reconstruction >= 4/5, Material continuation >= 4/5, Protected scene unchanged >= 4/5.",
    prompt_version: "remove_object:v1"
  },
  14: {
    id: 14,
    slug: "extend-image",
    name: "Extend Image",
    description: "Expand a render beyond its existing boundaries.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3-pro-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "Extend the supplied image to {{target_aspect_ratio}}. Keep original image content unchanged. Generate only the additional surroundings required outside the original boundaries. Continue architecture, flooring, ceiling, landscape, sky, perspective, material patterns, lighting and shadows naturally. USER REQUIREMENTS: {{custom_instruction}}",
    required_fields: ["source_image"],
    optional_fields: ["target_aspect_ratio", "custom_instruction"],
    default_values: {},
    estimated_time: "12-50 sec",
    async: false,
    manual_test_criteria: "Original pixels/composition visually preserved, Extension seam invisible, Perspective continuation >= 4/5, Architectural plausibility >= 4/5, Lighting continuity >= 4/5.",
    prompt_version: "extend_image:v1"
  },
  15: {
    id: 15,
    slug: "virtual-staging",
    name: "Virtual Staging",
    description: "Furnish and decorate an empty room.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3.1-flash-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "TASK: Virtually stage the supplied empty room.\nROOM AUTHORITY: Do not alter room dimensions, walls, windows, doors, ceiling, permanent architecture or camera.\nROOM TYPE: {{room_type}}\nSTYLE: {{style}}\nFURNITURE: {{furniture}}\nMATERIALS: {{materials}}\nCOLORS: {{colors}}\nMOOD: {{mood}}\nUse realistic furniture scale and circulation. Do not obstruct doors. Furniture must contact the floor naturally and cast plausible shadows.\n{{UNIVERSAL_QUALITY_BLOCK}}",
    required_fields: ["source_image"],
    optional_fields: ["room_type", "style", "furniture", "materials", "colors", "mood"],
    default_values: {},
    estimated_time: "8-25 sec",
    async: false,
    manual_test_criteria: "Room architecture preservation >= 95%, Furniture scale >= 4/5, Interior-design quality >= 4/5, Circulation plausibility >= 4/5, Lighting/shadow integration >= 4/5.",
    prompt_version: "virtual_staging:v1"
  },
  16: {
    id: 16,
    slug: "image-adjustments",
    name: "Image Adjustments",
    description: "Adjust brightness, contrast, saturation and related image properties.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "local_adjustment",
    default_model: "pillow-opencv",
    allowed_models: ["pillow-opencv"],
    model_dropdown: false,
    prompt_template: "",
    required_fields: ["source_image"],
    optional_fields: ["brightness", "contrast", "saturation", "temperature", "tint", "exposure", "highlights", "shadows", "sharpness", "gamma"],
    default_values: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, exposure: 0, highlights: 0, shadows: 0, sharpness: 0, gamma: 1 },
    estimated_time: "< 1 sec",
    async: false,
    manual_test_criteria: "Slider response deterministic, No geometry/content changes, Reset returns original image.",
    prompt_version: "image_adjustments:v1"
  },
  17: {
    id: 17,
    slug: "fix-people",
    name: "Fix People",
    description: "Correct distorted or unnatural people.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3-pro-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "Correct the selected person's visible anatomical/generation problems. Correct: hands, fingers, limbs, face, body proportions, posture, clothing geometry, floor/furniture contact. Preserve approximate position, pose, scale, activity and surrounding architecture. Match lighting, shadows, depth of field and color temperature. Do not alter unrelated people or architecture.",
    required_fields: ["source_image", "mask"],
    optional_fields: [],
    default_values: {},
    estimated_time: "10-35 sec",
    async: false,
    manual_test_criteria: "Anatomy >= 4/5, Hands/face improved, Original position preserved, Architecture unchanged, Lighting integration >= 4/5.",
    prompt_version: "fix_people:v1"
  },
  18: {
    id: 18,
    slug: "populate-render",
    name: "Populate Render",
    description: "Add realistic people to architectural scenes.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3.1-flash-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "Add realistic people to the supplied architectural visualization. NUMBER: {{people_count}}\nDESCRIPTION: {{people_description}}\nACTIVITY: {{activity}}\nPLACEMENT: {{placement}}\nPeople must have believable physical scale, respect perspective, contact actual surfaces, match lighting and cast plausible shadows. Do not alter architecture, furniture or camera.",
    required_fields: ["source_image"],
    optional_fields: ["people_count", "people_description", "activity", "placement"],
    default_values: { people_count: 2 },
    estimated_time: "8-25 sec",
    async: false,
    manual_test_criteria: "Human realism >= 4/5, Scale/perspective >= 4/5, Lighting integration >= 4/5, Architecture unchanged, No duplicate/distorted people.",
    prompt_version: "populate_render:v1"
  },
  19: {
    id: 19,
    slug: "change-camera-angle",
    name: "Change Camera Angle",
    description: "Create an approximate alternate viewpoint.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["video/mp4"],
    provider: "veo_video",
    default_model: "veo-3.1-lite",
    allowed_models: ["veo-3.1-lite"],
    model_dropdown: false,
    prompt_template: "A smooth architectural camera movement approximately {{angle_change}} to the {{direction}}. Maintain the same architecture, materials, furniture and lighting. Use stable professional architectural cinematography. No moving walls. No shifting windows. No moving furniture. No geometry morphing. End on a clean, stable architectural composition suitable for extraction as a still frame.",
    required_fields: ["source_image", "angle_change", "direction"],
    optional_fields: [],
    default_values: { audio: false, duration_seconds: 4 },
    estimated_time: "1-5 min",
    async: true,
    manual_test_criteria: "New viewpoint visibly changed, Project identity >= 4/5, Major geometry consistency >= 4/5, No visible object morphing, Final extracted frame sharp/stable.",
    prompt_version: "change_camera_angle:v1"
  },
  20: {
    id: 20,
    slug: "style-transfer",
    name: "Style Transfer",
    description: "Transfer the visual style of one image to another.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3-pro-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "IMAGE 1 defines architecture, geometry, layout and camera. IMAGE 2 defines aesthetic style. Transfer from Image 2: materials, colors, furniture aesthetic, decorative language, lighting mood, visual atmosphere. Preserve from Image 1: architecture, geometry, spatial layout, perspective, structural openings. Do not copy unrelated geometry from Image 2.",
    required_fields: ["source_image", "style_reference_image"],
    optional_fields: [],
    default_values: {},
    estimated_time: "10-35 sec",
    async: false,
    manual_test_criteria: "Style resemblance >= 4/5, Base architecture preservation >= 4/5, No reference-geometry leakage, Material/color transfer >= 4/5, Photorealism >= 4/5.",
    prompt_version: "style_transfer:v1"
  },
  21: {
    id: 21,
    slug: "change-material",
    name: "Change Material",
    description: "Change the material of a selected surface.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3-pro-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "Change only the material of: {{target_surface}}\nNEW MATERIAL: {{new_material}}\nColor: {{color}}\nTexture: {{texture}}\nFinish: {{finish}}\nRoughness: {{roughness}}\nPattern/veining: {{pattern}}\nJoints/grout: {{joints}}\nUse physically appropriate texture scale. Preserve exact surface geometry and all unrelated elements.",
    required_fields: ["source_image", "mask", "target_surface", "new_material"],
    optional_fields: ["color", "texture", "finish", "roughness", "pattern", "joints"],
    default_values: {},
    estimated_time: "10-35 sec",
    async: false,
    manual_test_criteria: "Only selected surface changes, Material identity >= 4/5, Texture scale >= 4/5, Lighting/reflection response >= 4/5, Geometry unchanged.",
    prompt_version: "change_material:v1"
  },
  22: {
    id: 22,
    slug: "change-season",
    name: "Change Season",
    description: "Transform the environmental season.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3.1-flash-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "Transform the supplied exterior visualization into {{target_season}}. Preserve building geometry, camera, permanent materials and hardscape. Update vegetation, ground condition, atmospheric color, sky and environmental lighting appropriately. Seasonal effects must be physically plausible. Do not redesign architecture.",
    required_fields: ["source_image", "target_season"],
    optional_fields: ["mood"],
    default_values: {},
    estimated_time: "6-20 sec",
    async: false,
    manual_test_criteria: "Season clearly recognizable, Architecture preservation >= 95%, Vegetation consistency >= 4/5, Weather/ground consistency >= 4/5, No unrealistic seasonal artifacts.",
    prompt_version: "change_season:v1"
  },
  23: {
    id: 23,
    slug: "change-time-of-day",
    name: "Change Time of Day",
    description: "Change the scene's lighting/time.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3.1-flash-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "Change scene illumination to {{target_time_of_day}}. Preserve architecture, geometry, materials, landscape, objects and camera.\nLIGHTING: {{lighting_description}}\nSUN: {{sun_direction}}\nINTERIOR LIGHTING: {{interior_lighting}}\nUpdate shadows, glazing reflections and color temperature consistently. Do not modify the design itself.",
    required_fields: ["source_image", "target_time_of_day"],
    optional_fields: ["lighting_description", "sun_direction", "interior_lighting"],
    default_values: {},
    estimated_time: "6-20 sec",
    async: false,
    manual_test_criteria: "Target time visually convincing >= 4/5, Shadow direction consistency >= 4/5, Architecture unchanged, Window/reflection behavior >= 4/5, No excessive color grading.",
    prompt_version: "change_time_of_day:v1"
  },
  24: {
    id: 24,
    slug: "change-weather",
    name: "Change Weather",
    description: "Change weather and atmospheric conditions.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3.1-flash-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "Change only environmental weather conditions to {{target_weather}}. Preserve architecture, geometry, materials, camera, landscape design and objects.\nWEATHER: {{weather_description}}\nATMOSPHERE: {{atmosphere}}\nGROUND: {{ground_condition}}\nSKY: {{sky}}\nLIGHT: {{lighting}}\nApply physically plausible wetness, reflection, fog, snow or diffused light as appropriate. Do not redesign architecture.",
    required_fields: ["source_image", "target_weather"],
    optional_fields: ["weather_description", "atmosphere", "ground_condition", "sky", "lighting"],
    default_values: {},
    estimated_time: "6-20 sec",
    async: false,
    manual_test_criteria: "Weather clearly recognizable, Physical effects coherent >= 4/5, Architecture unchanged >= 95%, Reflections/wetness/snow realistic >= 4/5, No excessive artificial effects.",
    prompt_version: "change_weather:v1"
  },
  25: {
    id: 25,
    slug: "design-to-maquette",
    name: "Design to Maquette",
    description: "Convert a design into a physical architectural-model aesthetic.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3-pro-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"],
    model_dropdown: true,
    prompt_template: "Convert the supplied architectural design into a professionally photographed physical architectural maquette. Preserve recognizable massing, proportions and primary geometry. Materials may include: white museum board, balsa wood, basswood, translucent acrylic, subtle grey card. Place the model on a clean architectural model base. Use professional studio tabletop photography and model-scale shadows. The result must clearly read as a physical scale model rather than a full-size real building.",
    required_fields: ["source_image"],
    optional_fields: ["maquette_material", "style"],
    default_values: {},
    estimated_time: "10-35 sec",
    async: false,
    manual_test_criteria: "Original massing recognizability >= 4/5, Clearly reads as physical model >= 4/5, Model material realism >= 4/5, Scale cues convincing, No major geometry change.",
    prompt_version: "design_to_maquette:v1"
  },
  26: {
    id: 26,
    slug: "upscale-and-enhance",
    name: "Upscale & Enhance",
    description: "Increase apparent detail/resolution of a render.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3-pro-image",
    allowed_models: ["gemini-3-pro-image"],
    model_dropdown: false,
    prompt_template: "Enhance the supplied architectural render to high-resolution professional presentation quality. Preserve exactly: composition, geometry, architecture, camera, objects, materials, colors, lighting. Improve only: micro-detail, texture clarity, edge quality, material definition, subtle reflections, fine architectural details, natural photographic sharpness. Do not hallucinate new design elements. Do not oversharpen.",
    required_fields: ["source_image"],
    optional_fields: ["upscale_factor"],
    default_values: { upscale_factor: "4x" },
    estimated_time: "15-50 sec",
    async: false,
    manual_test_criteria: "Output resolution increased, Fine-detail improvement >= 4/5, No hallucinated architecture, No material redesign, No oversharpening, Original composition preserved.",
    prompt_version: "upscale_and_enhance:v1"
  },
  27: {
    id: 27,
    slug: "upscale-video",
    name: "Upscale Video",
    description: "Increase video resolution.",
    input_types: ["video/mp4"],
    output_types: ["video/mp4"],
    provider: "veo_video",
    default_model: "veo-3.1-lite",
    allowed_models: ["veo-3.1-lite"],
    model_dropdown: false,
    prompt_template: "",
    required_fields: ["source_video"],
    optional_fields: ["target_resolution"],
    default_values: { target_resolution: "1080p" },
    estimated_time: "1-10 min",
    async: true,
    manual_test_criteria: "Resolution visibly improved, Video duration unchanged, No introduced geometry distortion, No flicker increase, Motion remains smooth, Audio preserved.",
    prompt_version: "upscale_video:v1"
  },
  28: {
    id: 28,
    slug: "image-to-video",
    name: "Image to Video",
    description: "Animate a static render into cinematic video.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["video/mp4"],
    provider: "veo_video",
    default_model: "veo-3.1-lite",
    allowed_models: ["veo-3.1-lite"],
    model_dropdown: false,
    prompt_template: "Create professional architectural cinematography beginning from the supplied image. Maintain architecture, furniture, materials, landscape and project identity. CAMERA MOVEMENT: {{camera_motion}}\nSPEED: {{speed}}\nSHOT TYPE: {{shot_type}}\nUse smooth stabilized professional motion. Maintain consistent architectural geometry and object identity. Avoid geometry morphing, moving walls, moving furniture, camera shake and sudden zoom. Use natural parallax and smooth acceleration/deceleration.",
    required_fields: ["source_image", "camera_motion"],
    optional_fields: ["speed", "shot_type", "audio", "duration_seconds", "resolution"],
    default_values: { duration_seconds: 4, resolution: "720p", audio: false },
    estimated_time: "1-5 min",
    async: true,
    manual_test_criteria: "Camera movement matches request >= 4/5, Architecture stable >= 4/5, No object morphing, Motion smooth >= 4/5, Source identity maintained, Video valid.",
    prompt_version: "image_to_video:v1"
  },
  29: {
    id: 29,
    slug: "image-to-3d-model",
    name: "Image to 3D Model",
    description: "Convert an object image into a reusable textured 3D asset.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["model/gltf-binary"],
    provider: "trellis_3d",
    default_model: "TRELLIS.2-4B",
    allowed_models: ["TRELLIS.2-4B"],
    model_dropdown: false,
    prompt_template: "",
    required_fields: ["source_image"],
    optional_fields: [],
    default_values: { task: "image_to_3d" },
    estimated_time: "2-6 min",
    async: true,
    manual_test_criteria: "Rotate result 360 deg: Silhouette match >= 4/5, Proportions >= 4/5, Texture correspondence >= 4/5, Back/side plausible, No severe holes, GLB imports correctly.",
    prompt_version: "image_to_3d_model:v1"
  },
  30: {
    id: 30,
    slug: "image-to-scene",
    name: "Image to Scene",
    description: "Convert room imagery into an explorable scene.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
    output_types: ["application/octet-stream"],
    provider: "trellis_3d",
    default_model: "TRELLIS.2-4B",
    allowed_models: ["TRELLIS.2-4B", "GSplat"],
    model_dropdown: true,
    prompt_template: "",
    required_fields: ["source_image"],
    optional_fields: [],
    default_values: { task: "generate_scene", format: "splat" },
    estimated_time: "3-10 min",
    async: true,
    manual_test_criteria: "Scene opens successfully, Navigation stable, Primary room proportions >= 4/5, Major furniture placement >= 4/5, No severe floating geometry, No catastrophic holes.",
    prompt_version: "image_to_scene:v1"
  },
  31: {
    id: 31,
    slug: "reference-guided",
    name: "Reference Guided",
    description: "This workflow creates architectural or interior renders using design drawings and visual references. The drawing guides the core design\u2014layout, geometry, proportions, openings, and key spatial details\u2014while reference images guide the style, materials, lighting, colors, and overall mood. Users can also add a text prompt for specific instructions. The final render should stay faithful to the design while adopting the desired visual character from the references.",
    input_types: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif", "text"],
    output_types: ["image/png"],
    provider: "vertex_image",
    default_model: "gemini-3-pro-image",
    allowed_models: ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image", "flux-2-pro", "stable-diffusion-xl"],
    model_dropdown: true,
    prompt_template: "TASK: Create a photorealistic architectural visualization using dual-channel drawing and reference guidance.\nDRAWING AUTHORITY: The attached design drawing strictly dictates the spatial layout, architectural geometry, wall partitions, openings, window placement, and core structural proportions.\nREFERENCE GUIDANCE: Extract and synthesize material textures, lighting conditions, atmosphere, color palette, and visual style from the attached reference images.\nDESIGN STYLE: {{style}}\nMATERIALS: {{materials}}\nLIGHTING: {{lighting}}\nENVIRONMENT: {{environment}}\nUSER INSTRUCTIONS: {{custom_instruction}}\n{{UNIVERSAL_QUALITY_BLOCK}}",
    required_fields: ["drawing_image"],
    optional_fields: ["reference_images", "user_input", "style", "materials", "lighting", "environment", "mood", "custom_instruction"],
    default_values: { controlnet_conditioning_scale: 0.85 },
    estimated_time: "10-35 sec (Pro) / 4-12 sec (Flash)",
    async: false,
    manual_test_criteria: "Core design drawing layout and openings preserved >= 95%, Reference style/material fidelity transferred >= 4/5, Photorealism >= 4/5, Cohesive architectural lighting and perspective synthesis.",
    prompt_version: "reference_guided:v1"
  }
};
var HUB_MAPPING = {
  1: "image_studio",
  2: "image_studio",
  3: "image_studio",
  4: "image_studio",
  5: "image_studio",
  6: "image_studio",
  7: "raster_canvas",
  8: "image_studio",
  9: "raster_canvas",
  10: "image_studio",
  11: "raster_canvas",
  12: "raster_canvas",
  13: "raster_canvas",
  14: "raster_canvas",
  15: "raster_canvas",
  16: "raster_canvas",
  17: "raster_canvas",
  18: "raster_canvas",
  19: "video_studio",
  20: "image_studio",
  21: "raster_canvas",
  22: "image_studio",
  23: "image_studio",
  24: "image_studio",
  25: "image_studio",
  26: "image_studio",
  27: "video_studio",
  28: "video_studio",
  29: "gen_3d",
  30: "gen_3d",
  31: "image_studio"
};
var WORKFLOWS = Object.fromEntries(
  Object.entries(RAW_WORKFLOWS).map(([idStr, wf]) => {
    const id = Number(idStr);
    return [id, { ...wf, hubCategory: HUB_MAPPING[id] || "image_studio" }];
  })
);

// services/aiRender/modelPricingRegistry.ts
var CONTROLNET_MODELS = ["flux-2-pro", "stable-diffusion-xl"];
function isControlNetSupported(modelId) {
  if (!modelId) return false;
  return CONTROLNET_MODELS.includes(modelId) || Boolean(MODELS[modelId]?.supportsControlNet);
}
var MODELS = {
  "gemini-3-pro-image": {
    callingName: "gemini-3-pro-image",
    displayName: "Nano Banana Pro",
    label: "Best Result",
    description: "Highest-quality option for demanding professional generation and editing.",
    costProfile: "Highest",
    speedProfile: "Slowest",
    resolutions: ["1K", "2K", "4K"],
    supportsControlNet: false
  },
  "gemini-3.1-flash-image": {
    callingName: "gemini-3.1-flash-image",
    displayName: "Nano Banana 2",
    label: "Balanced / Recommended",
    description: "High quality with substantially lower cost and faster processing than Pro.",
    costProfile: "Medium",
    speedProfile: "Fast",
    resolutions: ["512", "1K", "2K", "4K"],
    supportsControlNet: false
  },
  "gemini-3.1-flash-lite-image": {
    callingName: "gemini-3.1-flash-lite-image",
    displayName: "Nano Banana 2 Lite",
    label: "Fastest / Most Economical",
    description: "Optimized for quick previews, experimentation, and low-cost drafts.",
    costProfile: "Lowest",
    speedProfile: "Fastest",
    resolutions: ["1K"],
    supportsControlNet: false
  },
  "gemini-2.5-flash": {
    callingName: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    label: "Analysis Model",
    description: "Used internally for moodboard extraction and image annotations.",
    costProfile: "Lowest",
    speedProfile: "Fastest",
    resolutions: ["N/A"],
    supportsControlNet: false
  },
  "gemini-2.5-pro": {
    callingName: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    label: "High-Reasoning Analysis",
    description: "Used internally for localized bounding-box conversational analysis.",
    costProfile: "Medium",
    speedProfile: "Slow",
    resolutions: ["N/A"],
    supportsControlNet: false
  },
  "flux-2-pro": {
    callingName: "flux-2-pro",
    displayName: "FLUX.2 Pro",
    label: "Ultra-fidelity GPU Pro",
    description: "Next-generation FLUX.2 Pro custom-hosted image rendering engine.",
    costProfile: "Custom",
    speedProfile: "Medium",
    resolutions: ["1K", "2K", "4K"],
    supportsControlNet: true
  },
  "stable-diffusion-xl": {
    callingName: "stable-diffusion-xl",
    displayName: "Stable Diffusion XL",
    label: "Standard ControlNet GPU",
    description: "Stability AI SDXL model for sketch/elevation rendering.",
    costProfile: "Custom",
    speedProfile: "Medium",
    resolutions: ["1K"],
    supportsControlNet: true
  },
  "veo-3.1-lite": {
    callingName: "veo-3.1-lite",
    displayName: "Veo 3.1 Lite",
    label: "Cinematic Video",
    description: "Google Veo 3.1 Lite video generation and upscaling model.",
    costProfile: "Video",
    speedProfile: "Slow",
    resolutions: ["720p", "1080p"]
  },
  "TRELLIS.2-4B": {
    callingName: "TRELLIS.2-4B",
    displayName: "TRELLIS 2 (4B)",
    label: "3D Asset Generator",
    description: "Microsoft TRELLIS 2 engine for high-quality textured 3D assets.",
    costProfile: "3D",
    speedProfile: "Slow",
    resolutions: ["N/A"]
  },
  "GSplat": {
    callingName: "GSplat",
    displayName: "GSplat Scene",
    label: "3D Scene Splatting",
    description: "Gaussian Splatting scene reconstruction engine.",
    costProfile: "3D",
    speedProfile: "Slow",
    resolutions: ["N/A"]
  }
};
var PRICING_METADATA = {
  pricing_version: "2026-08-08",
  effective_date: "2026-08-08",
  currency: "USD",
  gpu_zonal_redundancy: false,
  // Set to true if zonal redundancy is verified
  video_upscale_price_config: "pending project SKU"
};
var GOOGLE_IMAGE_PRO_INPUT_1M = 2;
var GOOGLE_IMAGE_PRO_IMAGE_TOKENS = 560;
var GOOGLE_IMAGE_FLASH_INPUT_1M = 0.5;
var GOOGLE_IMAGE_FLASH_IMAGE_TOKENS = 1120;
var GOOGLE_IMAGE_LITE_INPUT_1M = 0.25;
var GOOGLE_IMAGE_LITE_IMAGE_TOKENS = 1120;
var GPU_NON_ZONAL_RATE = 3947e-7;
var GPU_ZONAL_RATE = 4989e-7;
var WorkflowCostEstimator = class {
  static calculate(workflowId, modelName, options = {}) {
    const inputImages = options.input_images_count ?? 1;
    const promptTokens = options.prompt_tokens_estimate ?? 1e3;
    const resolution = options.resolution ?? "2K";
    if (modelName === "gemini-3-pro-image") {
      const inputCost = promptTokens / 1e6 * GOOGLE_IMAGE_PRO_INPUT_1M + inputImages * (GOOGLE_IMAGE_PRO_IMAGE_TOKENS / 1e6) * GOOGLE_IMAGE_PRO_INPUT_1M;
      let outputCost = 0.1344;
      if (resolution === "4K") outputCost = 0.24;
      const timeText = resolution === "4K" ? "15\u201350 seconds" : "10\u201335 seconds";
      return { estimateUsd: parseFloat((inputCost + outputCost).toFixed(4)), durationText: timeText };
    }
    if (modelName === "gemini-3.1-flash-image") {
      const inputCost = promptTokens / 1e6 * GOOGLE_IMAGE_FLASH_INPUT_1M + inputImages * (GOOGLE_IMAGE_FLASH_IMAGE_TOKENS / 1e6) * GOOGLE_IMAGE_FLASH_INPUT_1M;
      let outputCost = 0.1008;
      if (resolution === "512") outputCost = 0.04482;
      else if (resolution === "1K") outputCost = 0.0672;
      else if (resolution === "4K") outputCost = 0.1512;
      let timeText = "6\u201318 seconds";
      if (resolution === "512" || resolution === "1K") timeText = "4\u201312 seconds";
      else if (resolution === "4K") timeText = "10\u201330 seconds";
      return { estimateUsd: parseFloat((inputCost + outputCost).toFixed(4)), durationText: timeText };
    }
    if (modelName === "gemini-3.1-flash-lite-image") {
      const inputCost = promptTokens / 1e6 * GOOGLE_IMAGE_LITE_INPUT_1M + inputImages * (GOOGLE_IMAGE_LITE_IMAGE_TOKENS / 1e6) * GOOGLE_IMAGE_LITE_INPUT_1M;
      const outputCost = 0.0336;
      return { estimateUsd: parseFloat((inputCost + outputCost).toFixed(4)), durationText: "2\u20138 seconds" };
    }
    if (modelName === "flux-2-pro" || modelName === "stable-diffusion-xl" || modelName === "TRELLIS.2-4B" || modelName === "GSplat") {
      const isZonal = PRICING_METADATA.gpu_zonal_redundancy;
      const secRate = isZonal ? GPU_ZONAL_RATE : GPU_NON_ZONAL_RATE;
      let warmSec = 30;
      let coldSec = 90;
      let durationText = "15\u201345 seconds";
      if (workflowId === 29) {
        warmSec = 120;
        coldSec = 300;
        durationText = "2\u20136 minutes";
      } else if (workflowId === 30) {
        warmSec = 180;
        coldSec = 450;
        durationText = "3\u201310 minutes";
      }
      const minCost = secRate * warmSec;
      const maxCost = secRate * coldSec;
      return { estimateUsd: parseFloat(minCost.toFixed(4)), durationText: `${durationText} (Est. cost range: $${minCost.toFixed(3)}-$${maxCost.toFixed(3)})` };
    }
    if (modelName === "veo-3.1-lite") {
      if (workflowId === 27) {
        return { estimateUsd: 0, durationText: "1\u201310 minutes", isPendingSku: true };
      }
      const duration = options.duration_seconds ?? 4;
      const hasAudio = options.audio ?? false;
      const res = options.resolution ?? "720p";
      let ratePerSec = 0.03;
      if (res === "1080p") {
        ratePerSec = hasAudio ? 0.08 : 0.05;
      } else {
        ratePerSec = hasAudio ? 0.05 : 0.03;
      }
      return { estimateUsd: parseFloat((duration * ratePerSec).toFixed(2)), durationText: "1\u20135 minutes" };
    }
    if (modelName === "gemini-2.5-flash") {
      return { estimateUsd: 5e-3, durationText: "2\u20138 seconds" };
    }
    if (modelName === "gemini-2.5-pro") {
      return { estimateUsd: 0.012, durationText: "3\u201312 seconds" };
    }
    return { estimateUsd: 0, durationText: "unknown" };
  }
};
var ActualUsageCostCalculator = class {
  static calculate(modelName, elapsedSec, options = {}) {
    const inputImages = options.input_images_count ?? 1;
    const inputTokens = options.inputTokens ?? 1e3;
    const resolution = options.resolution ?? "2K";
    if (modelName === "gemini-3-pro-image") {
      const inputCost = inputTokens / 1e6 * GOOGLE_IMAGE_PRO_INPUT_1M + inputImages * (GOOGLE_IMAGE_PRO_IMAGE_TOKENS / 1e6) * GOOGLE_IMAGE_PRO_INPUT_1M;
      const outputCost = resolution === "4K" ? 0.24 : 0.1344;
      return parseFloat((inputCost + outputCost).toFixed(5));
    }
    if (modelName === "gemini-3.1-flash-image") {
      const inputCost = inputTokens / 1e6 * GOOGLE_IMAGE_FLASH_INPUT_1M + inputImages * (GOOGLE_IMAGE_FLASH_IMAGE_TOKENS / 1e6) * GOOGLE_IMAGE_FLASH_INPUT_1M;
      let outputCost = 0.1008;
      if (resolution === "512") outputCost = 0.04482;
      else if (resolution === "1K") outputCost = 0.0672;
      else if (resolution === "4K") outputCost = 0.1512;
      return parseFloat((inputCost + outputCost).toFixed(5));
    }
    if (modelName === "gemini-3.1-flash-lite-image") {
      const inputCost = inputTokens / 1e6 * GOOGLE_IMAGE_LITE_INPUT_1M + inputImages * (GOOGLE_IMAGE_LITE_IMAGE_TOKENS / 1e6) * GOOGLE_IMAGE_LITE_INPUT_1M;
      return parseFloat((inputCost + 0.0336).toFixed(5));
    }
    if (modelName === "flux-2-pro" || modelName === "stable-diffusion-xl" || modelName === "TRELLIS.2-4B" || modelName === "GSplat") {
      const isZonal = PRICING_METADATA.gpu_zonal_redundancy;
      const rate = isZonal ? GPU_ZONAL_RATE : GPU_NON_ZONAL_RATE;
      return parseFloat(((elapsedSec + 30) * rate).toFixed(5));
    }
    if (modelName === "veo-3.1-lite") {
      const duration = options.duration_seconds ?? 4;
      const hasAudio = options.audio ?? false;
      const res = options.resolution ?? "720p";
      let ratePerSec = 0.03;
      if (res === "1080p") {
        ratePerSec = hasAudio ? 0.08 : 0.05;
      } else {
        ratePerSec = hasAudio ? 0.05 : 0.03;
      }
      return parseFloat((duration * ratePerSec).toFixed(5));
    }
    return 0;
  }
};

// services/aiRender/promptCompiler.ts
var IMAGE_STYLE_PROMPTS = {
  realistic: "high-end photorealistic architectural photography, realistic materials, balanced exposure, physically accurate lighting",
  artistic_sketch: "artistic hand-drawn architectural sketch, black and white pencil linework, artistic paper texture, clean hand-drawn strokes",
  architectural_drawing: "professional architectural drawing, clean precise ink lines, fine detailing, orthographic or perspective projection sketch, white background",
  oil_painting: "rich impasto oil painting, textured canvas, visible thick brushstrokes, artistic painterly style, classical oil colors",
  watercolor: "soft watercolor painting, bleeding pigments, artistic paper texture, delicate hand-painted washes, light artistic splashes",
  marker_drawing: "marker sketch, vibrant alcohol marker coloring, clean architectural outline, hand-colored architectural rendering",
  charcoal_drawing: "textured charcoal drawing, smudged dark shading, high contrast graphite and carbon strokes, artistic sketch paper",
  retro_comic: "retro comic book style, bold black outlines, halftone dot shading, vintage pop-art colors, stylized graphic illustration",
  illustration: "digital architectural illustration, clean vector shapes, stylized flat shading, modern artistic graphic design",
  dynamic_blur: "architectural rendering with dynamic motion blur, long exposure effects, light trails, sense of speed and movement, blurred figures and cars"
};
var UNIVERSAL_SOURCE_PRESERVATION_BLOCK = `SOURCE IMAGE AUTHORITY: Treat the supplied source image as authoritative for geometry, perspective and spatial composition. Unless explicitly requested otherwise, preserve: - camera position - camera direction - perspective - wall positions - floor geometry - ceiling geometry - structural openings - windows - doors - major architectural proportions - major object positions outside the requested edit Change only elements explicitly requested. Do not redesign unrelated portions of the scene.`;
var UNIVERSAL_QUALITY_BLOCK = `QUALITY AND REALISM: Create a professional architectural visualization suitable for presentation by a leading architecture, interior-design or real-estate visualization studio. Use physically believable proportions, realistic material response, accurate texture scale, natural reflections, plausible roughness, realistic illumination, contact shadows and balanced exposure. Materials should look physically real rather than synthetic or uniformly smooth. Maintain believable construction logic, furniture scale and human proportions. Lighting must interact consistently with geometry and materials. The output should resemble premium architectural photography or a professional high-end architectural rendering rather than obvious AI artwork. Avoid excessive HDR, artificial sharpening, oversaturation, plastic materials, warped geometry and implausible architectural details.`;
var IntentNormalizer = class {
  static parseFromText(text) {
    const lower = text.toLowerCase();
    const intent = {
      project_type: null,
      space_type: null,
      architectural_style: null,
      interior_style: null,
      design_intent: text,
      materials: [],
      colors: [],
      furniture: [],
      lighting: null,
      time_of_day: null,
      weather: null,
      season: null,
      camera_angle: null,
      lens: null,
      composition: null,
      location_context: null,
      landscape: null,
      people: null,
      mood: null,
      elements_to_change: [],
      elements_to_preserve: [],
      custom_instruction: text,
      image_style: null
    };
    if (lower.includes("luxurious") || lower.includes("luxury")) intent.interior_style = "luxurious contemporary";
    if (lower.includes("minimal") || lower.includes("minimalist")) intent.interior_style = "contemporary minimal";
    if (lower.includes("warm")) intent.interior_style = intent.interior_style ? "warm " + intent.interior_style : "warm contemporary minimal";
    if (lower.includes("living room") || lower.includes("living")) {
      intent.space_type = "living room";
      intent.project_type = "residential interior";
    } else if (lower.includes("fa\xE7ade") || lower.includes("facade") || lower.includes("exterior") || lower.includes("building")) {
      intent.project_type = "residential exterior";
      intent.space_type = "exterior facade";
    }
    if (lower.includes("oak") || lower.includes("wood")) intent.materials.push("natural oak");
    if (lower.includes("marble") || lower.includes("stone")) intent.materials.push("natural marble");
    if (lower.includes("boucle")) intent.materials.push("cream boucle fabric");
    if (lower.includes("daylight") || lower.includes("sun")) intent.lighting = "soft natural daylight";
    if (lower.includes("night") || lower.includes("evening")) intent.lighting = "warm twilight illumination";
    if (lower.includes("winter") || lower.includes("snow")) intent.season = "winter";
    if (lower.includes("summer")) intent.season = "summer";
    return intent;
  }
};
var DefaultResolver = class {
  static resolve(intent) {
    return {
      project_type: intent.project_type || "residential interior",
      space_type: intent.space_type || "contemporary living room",
      architectural_style: intent.architectural_style || "contemporary architectural style",
      interior_style: intent.interior_style || "warm contemporary minimal",
      design_intent: intent.design_intent || "modern spacious layout",
      materials: intent.materials.length > 0 ? intent.materials : ["natural oak", "warm off-white plaster", "subtle natural stone", "textured neutral fabrics"],
      colors: intent.colors.length > 0 ? intent.colors : ["warm neutrals", "off-whites", "earth tones"],
      furniture: intent.furniture.length > 0 ? intent.furniture : ["curated contemporary designer furniture"],
      lighting: intent.lighting || "soft natural daylight",
      time_of_day: intent.time_of_day || "mid-afternoon",
      weather: intent.weather || "clear sky",
      season: intent.season || "spring/summer",
      camera_angle: intent.camera_angle || "eye-level architectural photography",
      lens: intent.lens || "26mm full-frame equivalent",
      composition: intent.composition || "balanced editorial composition",
      location_context: intent.location_context || "urban neighborhood",
      landscape: intent.landscape || "manicured contemporary landscaping",
      people: intent.people || "minimal blurred figures for scale, avoiding distraction",
      mood: intent.mood || "calm, sophisticated and inviting",
      elements_to_change: intent.elements_to_change,
      elements_to_preserve: intent.elements_to_preserve,
      custom_instruction: intent.custom_instruction,
      image_style: intent.image_style || "realistic"
    };
  }
};
var PromptCompiler = class {
  static compile(workflow, resolved) {
    let template = workflow.prompt_template;
    if (!template) return resolved.custom_instruction || "";
    template = template.replace("{{project_type}}", resolved.project_type || "");
    template = template.replace("{{space_type}}", resolved.space_type || "");
    template = template.replace("{{architectural_style}}", resolved.architectural_style || "");
    template = template.replace("{{interior_style}}", resolved.interior_style || "");
    template = template.replace("{{design_intent}}", resolved.design_intent || "");
    template = template.replace("{{materials}}", (resolved.materials || []).join(", "));
    template = template.replace("{{colors}}", (resolved.colors || []).join(", "));
    template = template.replace("{{furniture}}", (resolved.furniture || []).join(", "));
    template = template.replace("{{lighting}}", resolved.lighting || "");
    template = template.replace("{{time_of_day}}", resolved.time_of_day || "");
    template = template.replace("{{camera_angle}}", resolved.camera_angle || "");
    template = template.replace("{{lens}}", resolved.lens || "");
    template = template.replace("{{composition}}", resolved.composition || "");
    template = template.replace("{{location_context}}", resolved.location_context || "");
    template = template.replace("{{landscape}}", resolved.landscape || "");
    template = template.replace("{{people}}", resolved.people || "");
    template = template.replace("{{mood}}", resolved.mood || "");
    template = template.replace("{{custom_instruction}}", resolved.custom_instruction || "");
    template = template.replace("{{style}}", resolved.interior_style || resolved.architectural_style || "");
    template = template.replace("{{environment}}", resolved.location_context || "");
    template = template.replace("{{glazing}}", "clear double-glazed low-E glass with thin black frames");
    template = template.replace("{{floor_materials}}", "polished microcement or light oak timber flooring");
    template = template.replace("{{room_labels}}", resolved.space_type || "");
    template = template.replace("{{room_type}}", resolved.space_type || "");
    template = template.replace("{{edit_instruction}}", resolved.custom_instruction || "");
    template = template.replace("{{identified_object}}", resolved.elements_to_change[0] || "selected element");
    template = template.replace("{{modification}}", resolved.custom_instruction || "");
    template = template.replace("{{target_object}}", resolved.elements_to_change[0] || "selected element");
    template = template.replace("{{target_surface}}", resolved.elements_to_change[0] || "selected surface");
    template = template.replace("{{new_material}}", resolved.materials[0] || "new material");
    template = template.replace("{{color}}", resolved.colors[0] || "natural");
    template = template.replace("{{texture}}", "realistic texture");
    template = template.replace("{{finish}}", "matte");
    template = template.replace("{{roughness}}", "slight roughness");
    template = template.replace("{{pattern}}", "subtle organic variation");
    template = template.replace("{{joints}}", "minimal flush joints");
    template = template.replace("{{angle_change}}", "15 degrees");
    template = template.replace("{{direction}}", "right");
    template = template.replace("{{camera_motion}}", "slow horizontal pan");
    template = template.replace("{{speed}}", "slow and stable");
    template = template.replace("{{shot_type}}", "eye-level wide architectural shot");
    let qualityBlock = UNIVERSAL_QUALITY_BLOCK;
    if (resolved.image_style && resolved.image_style !== "default" && resolved.image_style !== "realistic") {
      const styleInstruction = IMAGE_STYLE_PROMPTS[resolved.image_style];
      if (styleInstruction) {
        qualityBlock = `QUALITY AND STYLE: Render the output strictly in the style of: ${styleInstruction}. Create a professional architectural visualization in this style. Maintain physical proportions, accurate perspective, and balanced composition. The output must showcase high artistic craft in this medium, avoiding messy lines, artifacts, or digital glitches. Do not force photorealism.`;
      }
    } else if (resolved.image_style === "realistic") {
      const styleInstruction = IMAGE_STYLE_PROMPTS[resolved.image_style];
      qualityBlock = `QUALITY AND PHOTOREALISM: Render the output strictly in the style of: ${styleInstruction}. ${UNIVERSAL_QUALITY_BLOCK}`;
    }
    template = template.replace("{{SOURCE_IMAGE_AUTHORITY}}", UNIVERSAL_SOURCE_PRESERVATION_BLOCK);
    template = template.replace("{{UNIVERSAL_QUALITY_BLOCK}}", qualityBlock);
    if (resolved.image_style && resolved.image_style !== "default") {
      const styleDesc = IMAGE_STYLE_PROMPTS[resolved.image_style];
      if (styleDesc) {
        const styleBlock = `IMAGE RENDERING STYLE: Render the output strictly as a ${styleDesc}.`;
        template = `${styleBlock}

${template}`;
      }
    }
    if (resolved.custom_instruction && resolved.custom_instruction.trim() && !workflow.prompt_template.includes("{{custom_instruction}}") && !workflow.prompt_template.includes("{{edit_instruction}}") && !workflow.prompt_template.includes("{{design_intent}}")) {
      const userBlock = `USER CUSTOM DIRECTIVES (HIGH PRIORITY): ${resolved.custom_instruction.trim()}`;
      if (template.includes(qualityBlock)) {
        template = template.replace(qualityBlock, `${userBlock}

${qualityBlock}`);
      } else {
        template = `${template}

${userBlock}`;
      }
    }
    return template.trim();
  }
};

// services/aiRender/promptEnhancer.ts
var PromptEnhancerEngine = class {
  /**
   * Builds a clean, direct, 100% faithful Reference-Guided prompt structure
   * that strictly enforces the uploaded Drawing's architectural geometry and
   * the uploaded Reference's visual style, materials, lighting, and finishes.
   */
  static buildReferenceGuidedPrompt(request) {
    const metaList = request.reference_images_metadata || [];
    const drawings = metaList.filter((m) => m.category === "drawing" || !m.category && (m.label?.toLowerCase().includes("drawing") || m.label?.toLowerCase().includes("floorplan") || m.label?.toLowerCase().includes("elevation") || m.label?.toLowerCase().includes("sketch") || m.id === "1"));
    const references = metaList.filter((m) => m.category === "reference" || !drawings.includes(m));
    const drawingPrompts = [];
    if (drawings.length > 0) {
      drawings.forEach((d, i) => {
        const rawType = d.drawingType === "Custom" && d.customDrawingType?.trim() ? d.customDrawingType.trim() : d.drawingType || "Floor Plan";
        let typeName = rawType;
        if (rawType.toLowerCase().includes("floor") || rawType.toLowerCase().includes("plan")) typeName = "Floorplan";
        else if (rawType.toLowerCase().includes("elevation") || rawType.toLowerCase().includes("facade")) typeName = "Elevation";
        else if (rawType.toLowerCase().includes("sketch")) typeName = "Sketch";
        else if (rawType.toLowerCase().includes("3d") || rawType.toLowerCase().includes("model")) typeName = "3D Model Screenshot";
        else if (rawType.toLowerCase().includes("section")) typeName = "Section Drawing";
        const imgLabel = `[Image ${d.id || i + 1}: Design Drawing - ${typeName}]`;
        const notes = d.label?.trim() ? ` [Drawing Notes: ${d.label.trim()}]` : "";
        if (typeName.toLowerCase().includes("floorplan") || typeName.toLowerCase().includes("plan")) {
          drawingPrompts.push(`- Use the image ${imgLabel}${notes} as floorplan of the space. Produce an architectural/interior rendering following 100% of architectural and interior layout details as per the floorplan (exact room partitions, walls, kitchen counters/islands, sinks, appliances, furniture layout, door openings, and window locations). Irrespective of whichever camera angle or perspective view is chosen, the rendered space MUST be of this exact floorplan without altering, moving, or hallucinating any layout geometry.`);
        } else if (typeName.toLowerCase().includes("elevation")) {
          drawingPrompts.push(`- Use the image ${imgLabel}${notes} as the elevation drawing of the space. Produce a render following 100% of architectural facade details, vertical proportions, rooflines, and window/door openings as per this elevation.`);
        } else if (typeName.toLowerCase().includes("sketch")) {
          drawingPrompts.push(`- Use the image ${imgLabel}${notes} as the architectural sketch. Produce a render following 100% of the architectural design, perspective lines, massing, and spatial geometry as per this sketch.`);
        } else if (typeName.toLowerCase().includes("3d")) {
          drawingPrompts.push(`- Use the image ${imgLabel}${notes} as the 3D model screenshot. Produce a render preserving 100% of the 3D spatial geometry, perspective view, and volumetric massing.`);
        } else if (typeName.toLowerCase().includes("section")) {
          drawingPrompts.push(`- Use the image ${imgLabel}${notes} as the section drawing. Produce a render following 100% of the vertical ceiling heights, slab thicknesses, and floor levels.`);
        } else {
          drawingPrompts.push(`- Use the image ${imgLabel}${notes} as the architectural drawing. Produce a render following 100% of the architectural structure, geometry, and layout details as per this drawing.`);
        }
      });
    } else {
      drawingPrompts.push(`- Use the image [Image 1: Design Drawing - Floorplan] as floorplan of the space. Produce an architectural render following 100% of the architectural layout, walls, and spatial details as per the floorplan.`);
    }
    const referencePrompts = [];
    if (references.length > 0) {
      references.forEach((r, i) => {
        const imgIndex = r.id || drawings.length + i + 1;
        const aspects = r.referenceAspects && r.referenceAspects.length > 0 ? r.referenceAspects : ["All (Complete Theme & Mood)"];
        let aspectsLabel = "";
        if (aspects.includes("All (Complete Theme & Mood)")) {
          aspectsLabel = "All Theme (Style, Lighting, Materials, Furniture, Landscape)";
        } else {
          aspectsLabel = aspects.map((a) => a.split(" ")[0]).join(", ");
        }
        const imgLabel = `[Image ${imgIndex}: Visual Reference - ${aspectsLabel}]`;
        const notes = r.label?.trim() ? ` [Reference Notes: ${r.label.trim()}]` : "";
        if (aspects.includes("All (Complete Theme & Mood)")) {
          referencePrompts.push(`- Use the image ${imgLabel}${notes} as visual reference for style, lighting, and materials of all elements (ceiling, walls, flooring, cabinetry finishes, furniture, fixtures, lighting ambiance, and outdoor environment if any). 100% faithfully replicate this exact visual theme, color palette, and material finishes across the space.`);
        } else {
          const detailDirectives = [];
          if (aspects.includes("Visual Style & Theme")) detailDirectives.push("visual design style, aesthetic identity, and color palette");
          if (aspects.includes("Materials & Textures")) detailDirectives.push("materials and surface finishes of all elements (wood, stone, metal, fabrics, ceiling, walls, flooring)");
          if (aspects.includes("Lighting & Atmosphere")) detailDirectives.push("lighting conditions, color temperature, shadow softness, and ambient illumination");
          if (aspects.includes("Furniture & Decor")) detailDirectives.push("furniture style, cabinetry design, and decor elements");
          if (aspects.includes("Environment & Landscape")) detailDirectives.push("outdoor landscape, vegetation, and contextual surroundings");
          referencePrompts.push(`- Use the image ${imgLabel}${notes} as visual reference for ${detailDirectives.join("; ")}. 100% faithfully extract and apply these elements to the space.`);
        }
      });
    } else {
      referencePrompts.push(`- Use the attached visual reference image(s) as visual reference for style, lighting, and materials of all elements.`);
    }
    let userDirective = "";
    const cleanInput = (request.user_input || "").trim();
    if (cleanInput && cleanInput.toLowerCase() !== "reference guided" && cleanInput.toLowerCase() !== "reference-guided") {
      userDirective = `

USER SPECIFIC INSTRUCTIONS:
${cleanInput}`;
    }
    return `TASK: Produce a professional architectural rendering by strictly synthesizing the attached Design Drawing and Visual Reference:

1. ARCHITECTURAL LAYOUT & GEOMETRY (Drawing Authority):
${drawingPrompts.join("\n")}

2. VISUAL STYLE, MATERIALS & LIGHTING (Reference Authority):
${referencePrompts.join("\n")}

3. SYNTHESIS MANDATE:
The Design Drawing 100% dictates the spatial layout, walls, and geometry. The Visual Reference 100% dictates the visual style, materials, lighting, and finishes. Produce a single cohesive, high-end architectural photograph matching both with 100% fidelity.${userDirective}

VISUAL QUALITY: High-end architectural photography, 8k crisp details, physically accurate light bounces and contact shadows, balanced natural exposure, no distortion.`;
  }
  /**
   * Fast rule-based contextual prompt generator for offline or instant local fallback.
   * Features a Universal Dynamic Fallback Engine: If a prompt is out-of-syllabus (e.g. beach, mountain,
   * cave, space, fantasy environment), it NEVER injects hardcoded assumptions or unrelated furniture.
   * It produces a 100% safe, contextually true, non-presumptive structured prompt.
   */
  static enhanceOffline(request) {
    const workflow = WORKFLOWS[request.workflow_id] || WORKFLOWS[1];
    if (workflow.slug === "reference-guided") {
      return this.buildReferenceGuidedPrompt(request);
    }
    const input = (request.user_input || "").trim();
    const lower = input.toLowerCase();
    const styleKey = request.image_style || "realistic";
    const styleDesc = IMAGE_STYLE_PROMPTS[styleKey] || IMAGE_STYLE_PROMPTS["realistic"];
    let userDetectedStyle = null;
    let styleMaterialsOverride = null;
    let styleFurnitureOverride = null;
    if (lower.includes("classical") || lower.includes("neoclassical") || lower.includes("traditional") || lower.includes("victorian") || lower.includes("baroque") || lower.includes("georgian")) {
      userDetectedStyle = "classical architectural style featuring intricate wainscoting, crown moldings, wall sconces, and refined period craftsmanship";
      styleMaterialsOverride = "honed calacatta marble, carved mahogany wood paneling, ornate ceiling plasterwork, gilded bronze fixtures, rich velvet textiles";
      styleFurnitureOverride = "carved wooden console, tufted Chesterfield seating, antique brass hardware, upholstered wingback armchairs";
    } else if (lower.includes("industrial") || lower.includes("urban loft") || lower.includes("raw concrete") || lower.includes("exposed brick")) {
      userDetectedStyle = "industrial architectural style with exposed structural steel, raw concrete finishes, and utilitarian open-plan aesthetics";
      styleMaterialsOverride = "board-formed raw concrete, exposed steel I-beams, reclaimed red brickwork, polished concrete floors, matte black metal framing";
      styleFurnitureOverride = "steel-frame industrial desks, distressed leather sofas, factory-pendant lighting, reclaimed wood shelving";
    } else if (lower.includes("japandi") || lower.includes("wabi-sabi") || lower.includes("zen") || lower.includes("japanese minimal")) {
      userDetectedStyle = "japandi architectural style fusing Scandinavian functionality with minimalist Japanese wabi-sabi organic harmony";
      styleMaterialsOverride = "pale white oak, micro-cement plaster walls, natural unbleached linen, paper lantern diffusers, woven tatami textures";
      styleFurnitureOverride = "low-profile solid wood seating, minimal slatted wood divider screens, handcrafted ceramic vessels, organic wool rugs";
    } else if (lower.includes("scandinavian") || lower.includes("nordic") || lower.includes("hygge")) {
      userDetectedStyle = "scandinavian architectural style characterized by light wood tones, functional minimalism, and daylight optimization";
      styleMaterialsOverride = "light ash wood flooring, white painted brick, wool upholstery, matte brass, sheer linen curtains";
      styleFurnitureOverride = "minimalist Scandinavian lounge chairs, light wood dining table, subtle geometric pendant lights";
    } else if (lower.includes("mid-century") || lower.includes("mcm") || lower.includes("retro modern")) {
      userDetectedStyle = "mid-century modern architectural style featuring organic geometric shapes, rich timber veneers, and seamless integration";
      styleMaterialsOverride = "rich teak veneer, terrazzo tile flooring, accent brickwork, brushed brass, warm walnut paneling";
      styleFurnitureOverride = "iconic molded plywood lounge chairs, tapered wooden legs, sunburst wall sconces, retro credenza";
    } else if (lower.includes("brutalist") || lower.includes("monolithic") || lower.includes("beton brut")) {
      userDetectedStyle = "brutalist architectural style celebrating monolithic concrete geometry, bold architectural volumes, and raw material mass";
      styleMaterialsOverride = "heavy board-formed exposed concrete, raw slate stone, darkened steel plates, unvarnished timber accents";
      styleFurnitureOverride = "monolithic concrete seating benches, blocky geometric upholstered seating, recessed wall niches";
    } else if (lower.includes("art deco") || lower.includes("glam") || lower.includes("luxury deco")) {
      userDetectedStyle = "art deco architectural style featuring bold geometric motifs, luxurious polished metallic accents, and high-contrast elegance";
      styleMaterialsOverride = "high-gloss ebony timber, polished brass inlay, fluted glass panels, nero marquina marble, velvet upholstery";
      styleFurnitureOverride = "curved velvet plush sofas, geometric mirrored consoles, brass sunburst chandeliers, chevron inlay accent tables";
    } else if (lower.includes("biophilic") || lower.includes("organic architecture") || lower.includes("green building")) {
      userDetectedStyle = "biophilic organic architectural style integrating living natural foliage, fluid organic curves, and daylight immersion";
      styleMaterialsOverride = "living plant walls, rammed earth surfaces, curved bamboo, natural river stone pavers, triple-glazed glass";
      styleFurnitureOverride = "curved organic seating, rattan loungers, integrated planter benches, natural timber slab tables";
    } else if (lower.includes("high-tech") || lower.includes("parametric") || lower.includes("futuristic")) {
      userDetectedStyle = "high-tech parametric architectural style featuring fluid curved geometry, smart lighting integration, and advanced structural glazing";
      styleMaterialsOverride = "white composite solid surfaces, curved structural glass, anodized aluminum panels, LED cove illumination";
      styleFurnitureOverride = "sculptural fluid lounge pods, integrated smart touch consoles, ergonomic floating desks";
    } else if (lower.includes("rustic") || lower.includes("farmhouse") || lower.includes("country house")) {
      userDetectedStyle = "rustic farmhouse architectural style with exposed timber trusses, tactile natural stone, and warm artisanal elements";
      styleMaterialsOverride = "hand-hewn wooden ceiling beams, fieldstone masonry, lime-washed plaster, forged iron hardware";
      styleFurnitureOverride = "reclaimed wood trestle dining table, woven rush chairs, wrought iron chandelier, slipcovered sofas";
    } else if (lower.includes("mediterranean") || lower.includes("spanish villa") || lower.includes("tuscan")) {
      userDetectedStyle = "mediterranean villa architectural style with whitewashed stucco walls, terracotta tile flooring, and graceful arched openings";
      styleMaterialsOverride = "terracotta floor tiles, hand-painted ceramic tiles, wrought iron railings, lime plaster walls, exposed dark timber beams";
      styleFurnitureOverride = "carved wood benches, wrought iron outdoor tables, linen-draped daybeds, rustic timber sideboard";
    } else if (lower.includes("minimalist") || lower.includes("ultra-minimal") || lower.includes("clean lines")) {
      userDetectedStyle = "ultra-minimalist architectural style focusing on pure geometric form, hidden joinery, and shadow gaps";
      styleMaterialsOverride = "seamless micro-cement flooring, matte white wall surfaces, flush trimless doors, hidden architectural light slots";
      styleFurnitureOverride = "recessed flush cabinetry, low-profile linear seating, minimal monolithic tables";
    }
    let detectedSpace = "";
    if (lower.includes("bird's eye") || lower.includes("birds eye") || lower.includes("aerial") || lower.includes("drone view") || lower.includes("top down") || lower.includes("top-down")) {
      detectedSpace = "Bird's Eye Aerial View & Spatial Perspective";
    } else if (lower.includes("bathroom") || lower.includes("bath") || lower.includes("ensuite") || lower.includes("powder room") || lower.includes("washroom") || lower.includes("spa")) {
      detectedSpace = "Luxury Bathroom & Spa Enclosure";
    } else if (lower.includes("pool") || lower.includes("swimming pool") || lower.includes("infinity pool") || lower.includes("jacuzzi")) {
      detectedSpace = "Outdoor Swimming Pool & Sun Deck";
    } else if (lower.includes("living room") || lower.includes("living area") || lower.includes("salon") || lower.includes("lounge")) {
      detectedSpace = "Living Room & Social Lounge";
    } else if (lower.includes("kitchen") || lower.includes("culinary") || lower.includes("kitchenette") || lower.includes("pantry")) {
      detectedSpace = "Modern Kitchen & Island Dining";
    } else if (lower.includes("bedroom") || lower.includes("master bed") || lower.includes("guest room") || lower.includes("suite")) {
      detectedSpace = "Master Bedroom Suite";
    } else if (lower.includes("dining") || lower.includes("dining room") || lower.includes("banquet")) {
      detectedSpace = "Dining Room & Entertaining Area";
    } else if (lower.includes("terrace") || lower.includes("patio") || lower.includes("deck") || lower.includes("balcony") || lower.includes("veranda")) {
      detectedSpace = "Outdoor Terrace & Lounge Deck";
    } else if (lower.includes("facade") || lower.includes("fa\xE7ade") || lower.includes("exterior") || lower.includes("front elevation")) {
      detectedSpace = "Exterior Architectural Facade & Main Elevation";
    } else if (lower.includes("lobby") || lower.includes("reception") || lower.includes("foyer") || lower.includes("entrance hall") || lower.includes("entryway")) {
      detectedSpace = "Grand Entryway & Reception Foyer";
    } else if (lower.includes("courtyard") || lower.includes("atrium") || lower.includes("garden courtyard")) {
      detectedSpace = "Central Landscaped Courtyard & Atrium";
    } else if (lower.includes("office") || lower.includes("workspace") || lower.includes("conference") || lower.includes("study")) {
      detectedSpace = "Executive Office & Workspace";
    } else if (lower.includes("garden") || lower.includes("lawn") || lower.includes("backyard") || lower.includes("landscape")) {
      detectedSpace = "Manicured Landscape Garden & Grounds";
    }
    const isInteriorLike = lower.includes("inside") || lower.includes("interior") || lower.includes("room") || lower.includes("hall") || lower.includes("bath") || lower.includes("kitchen") || lower.includes("bedroom") || lower.includes("office") || lower.includes("cave");
    const isExteriorLike = lower.includes("exterior") || lower.includes("facade") || lower.includes("fa\xE7ade") || lower.includes("building") || lower.includes("tower") || lower.includes("stadium") || lower.includes("outside");
    const isNatureLike = lower.includes("beach") || lower.includes("mountain") || lower.includes("forest") || lower.includes("landscape") || lower.includes("park") || lower.includes("sea") || lower.includes("river") || lower.includes("canyon") || lower.includes("desert") || lower.includes("nature") || lower.includes("island");
    const isSpaceLike = lower.includes("space") || lower.includes("orbit") || lower.includes("moon") || lower.includes("planet") || lower.includes("station");
    let project = isSpaceLike ? "Aerospace & Orbital Station" : isNatureLike ? "Landscape & Natural Environment" : isInteriorLike ? "Residential Interior" : isExteriorLike ? "Residential & Commercial Architecture" : "Architectural Visualization Project";
    let scene = input || workflow.name;
    let designDirection = userDetectedStyle || "Contemporary architectural and interior design with refined detailing, clean geometry, and harmonious proportions";
    let materials = styleMaterialsOverride || "Natural oak timber, honed stone, smooth plaster, textured textiles, and brushed metal accents";
    let colors = "Cohesive architectural palette with neutral tones, warm wood accents, and natural textures";
    let furniture = styleFurnitureOverride || "Contextually appropriate architectural furniture with ergonomic proportions and clean joinery";
    let lighting = "Soft natural daylight with balanced exposure and gentle contact shadows";
    let timeOfDay = "Mid-afternoon";
    let environment = "Surrounding natural site context, lush foliage, and open clear sky";
    let mood = "Atmospheric, serene, balanced, and immersive architectural presence";
    if (lower.includes("stadium") || lower.includes("arena") || lower.includes("cricket") || lower.includes("football") || lower.includes("soccer") || lower.includes("sports complex") || lower.includes("athletic") || lower.includes("ballpark") || lower.includes("gymnasium") || lower.includes("colosseum") || lower.includes("grandstand")) {
      project = "Sports & Athletic Venue";
      if (!detectedSpace) detectedSpace = "Cricket Stadium & Playing Field Arena";
      scene = input ? `${input}` : "Modern sports stadium & athletic playing field";
      designDirection = userDetectedStyle || "Modern sports stadium architecture with expansive grandstands and structural canopy";
      furniture = "Stadium grandstand seating, player dugouts, LED perimeter scoreboards, team benches";
      materials = styleMaterialsOverride || "Hybrid grass turf, polished concrete concourses, structural steel roof trusses, high-impact stadium seating modules";
      colors = "Vibrant green turf, neutral concrete greys, bold stadium accent trim";
      environment = "Sports complex precinct, high-mast floodlight towers, open sky";
      mood = "Grand, heroic, atmospheric, monumental athletic presence";
    } else if (lower.includes("high rise") || lower.includes("skyscraper") || lower.includes("tower") || lower.includes("curtain wall") || lower.includes("building exterior") || lower.includes("commercial exterior")) {
      project = "Commercial Architecture";
      if (!detectedSpace) detectedSpace = "High-Rise Architectural Facade & Skyline View";
      scene = input ? `${input}` : "High-rise architectural building facade";
      furniture = "Ground-floor streetscape planters, architectural entrance canopy";
      materials = styleMaterialsOverride || "Unitized high-performance glass curtain wall, anodized aluminum composite panels, architectural louvers, structural steel frame";
      colors = "Reflective silver glass, dark bronze aluminum trim, concrete greys";
      environment = "Vibrant city financial district, urban boulevard with surrounding towers";
      mood = "Monolithic, iconic, prestigious urban presence";
    } else if (lower.includes("urban") || lower.includes("plaza") || lower.includes("masterplan") || lower.includes("master plan") || lower.includes("pedestrian zone") || lower.includes("civic") || lower.includes("streetscape")) {
      project = "Urban Master Plan & Civic Plaza";
      if (!detectedSpace) detectedSpace = "Public Urban Pedestrian Plaza & Gathering Space";
      scene = input ? `${input}` : "Public urban pedestrian plaza & transit hub";
      furniture = "Integrated stone public benches, outdoor cafe seating, street lighting posts, bike racks";
      materials = styleMaterialsOverride || "Granite paving tiles, linear water features, integrated stone seating, public art sculptures, permeable pavers";
      colors = "Cool granite greys, warm timber accents, lush urban greenery";
      environment = "Active city center, pedestrian walkways, surrounding modern mixed-use architecture";
      mood = "Vibrant, public, human-scaled civic experience";
    } else if (lower.includes("lawn") || lower.includes("garden") || lower.includes("landscape") || lower.includes("hardscape") || lower.includes("patio") || lower.includes("pool") || lower.includes("yard") || lower.includes("terrace") || lower.includes("park") || lower.includes("deck") || lower.includes("balcony") || lower.includes("courtyard")) {
      project = "Landscape & Outdoor Architecture";
      if (!detectedSpace) detectedSpace = lower.includes("pool") ? "Outdoor Infinity Pool & Living Deck" : lower.includes("lawn") ? "Landscaped Lawn & Garden" : "Outdoor Living Terrace & Patio";
      scene = input ? `${input}` : lower.includes("lawn") ? "exterior lawn & landscaped garden" : lower.includes("park") ? "public park & landscape gardens" : "outdoor hardscape living terrace";
      furniture = styleFurnitureOverride || "Modern outdoor garden loungers, teak patio seating, outdoor architectural planters, fire pit lounge";
      materials = styleMaterialsOverride || "Lush natural turf, bluestone pavers, natural timber decking, architectural glass, dark metal trim, water features";
      colors = "Deep greens, warm earth tones, cool stone greys";
      environment = "Manicured contemporary landscaping, mature canopy trees, open sky";
      mood = "Serene, expansive, high-end landscape ambiance";
    } else if (lower.includes("restaurant") || lower.includes("cafe") || lower.includes("lounge") || lower.includes("bar") || lower.includes("bistro") || lower.includes("coffee shop")) {
      project = "Commercial Hospitality & Dining";
      if (!detectedSpace) detectedSpace = "Boutique Restaurant Dining Hall & Cocktail Bar";
      scene = input ? `${input}` : "High-end boutique restaurant & lounge";
      furniture = styleFurnitureOverride || "Curated dining banquettes, marble-top tables, upholstered dining armchairs, bar stools";
      materials = styleMaterialsOverride || "Fluted timber bar front, ambient warm LED cove strip lighting, acoustic plaster, polished brass trim, terrazzo floor";
      colors = "Rich warm amber, dark walnut, deep forest green accents";
      environment = "Bustling urban hospitality venue with warm interior atmosphere";
      mood = "Intimate, moody, atmospheric, inviting";
    } else if (lower.includes("commercial office") || lower.includes("corporate") || lower.includes("co-working") || lower.includes("conference room") || lower.includes("headquarters") || lower.includes("tech office")) {
      project = "Corporate & Commercial Office";
      if (!detectedSpace) detectedSpace = "Open-Plan Corporate Office & Executive Lounge";
      scene = input ? `${input}` : "Modern corporate office & open workspace";
      furniture = styleFurnitureOverride || "Ergonomic task desks, modular acoustic lounge pods, executive conference table, breakroom seating";
      materials = styleMaterialsOverride || "Acoustic ceiling baffles, glazed office partitions, polished micro-cement flooring, oak veneer paneling";
      colors = "Clean whites, subtle charcoal, warm timber, corporate blue/green accents";
      environment = "Bright professional office floor with floor-to-ceiling perimeter glazing";
      mood = "Collaborative, focused, innovative, professional";
    } else if (lower.includes("retail") || lower.includes("showroom") || lower.includes("store") || lower.includes("boutique") || lower.includes("mall")) {
      project = "Commercial Retail & Showroom";
      if (!detectedSpace) detectedSpace = "Luxury Retail Boutique & Product Display Space";
      scene = input ? `${input}` : "Luxury retail store & product showroom";
      furniture = styleFurnitureOverride || "Sculptural product display pedestals, customer lounge seating, minimalist cash wrap desk";
      materials = styleMaterialsOverride || "Backlit onyx display walls, polished terrazzo floor, minimalist brass clothing racks, frameless glass display cases";
      colors = "Neutral ivory, warm gold accents, soft greys";
      environment = "High-end shopping district interior";
      mood = "Exclusive, curated, luxurious, pristine";
    } else if (lower.includes("hotel") || lower.includes("reception") || lower.includes("atrium") || lower.includes("resort")) {
      project = "Hospitality & Resort";
      if (!detectedSpace) detectedSpace = "Luxury Hotel Grand Atrium & Reception Lobby";
      scene = input ? `${input}` : "Luxury hotel reception lobby & atrium";
      furniture = styleFurnitureOverride || "Curved reception desk, luxury lounge clusters, architectural side tables, plush accent armchairs";
      materials = styleMaterialsOverride || "Double-height marble feature wall, custom glass chandelier, brass trim, acoustical plaster ceiling";
      colors = "Warm beige, champagne bronze, rich deep navy";
      environment = "Five-star hotel grand atrium with lush indoor landscaping";
      mood = "Grand, welcoming, opulent, serene";
    } else if (lower.includes("museum") || lower.includes("gallery") || lower.includes("library") || lower.includes("auditorium") || lower.includes("cultural") || lower.includes("university") || lower.includes("school") || lower.includes("campus")) {
      project = "Institutional & Cultural Architecture";
      if (!detectedSpace) detectedSpace = "Sculptural Exhibition Gallery & Central Hall";
      scene = input ? `${input}` : "Contemporary art gallery & museum exhibition space";
      furniture = styleFurnitureOverride || "Sculptural display plinths, minimalist bench seating";
      materials = styleMaterialsOverride || "Smooth white museum plaster, polished concrete floors, concealed perimeter lighting slots, acoustic ceiling";
      colors = "Pure architectural white, neutral concrete greys, dark accent framing";
      environment = "Cultural institution precinct";
      mood = "Contemplative, luminous, spacious, serene";
    } else if (lower.includes("villa") || lower.includes("house") || lower.includes("home") || lower.includes("mansion") || lower.includes("apartment") || lower.includes("penthouse") || lower.includes("residence") || lower.includes("residential")) {
      project = "Residential Architecture & Living";
      if (!detectedSpace) detectedSpace = "Contemporary Living Space & Indoor-Outdoor Connection";
    }
    const fullProjectDescriptor = detectedSpace ? `${project} \u2014 ${detectedSpace}` : `${project} \u2014 ${scene}`;
    let finalPeople = "no people, clean unpopulated architectural space";
    if (request.people === "blurred") {
      finalPeople = "subtle architectural motion-blurred figures passing naturally through the space to emphasize human scale";
    } else if (request.people === "realistic") {
      finalPeople = "naturally posed, stylishly dressed people engaged authentically in the environment with realistic interaction";
    }
    let finalCamera = "eye-level architectural one-point perspective with straight vertical lines";
    if (request.camera_angle === "custom" && request.custom_camera?.trim()) {
      finalCamera = request.custom_camera.trim();
    } else if (request.camera_angle === "eye_level") {
      finalCamera = "eye-level straight architectural perspective with perfectly vertical wall lines";
    } else if (request.camera_angle === "low_angle") {
      finalCamera = "low-angle dynamic architectural perspective looking slightly upward to convey monumentality";
    } else if (request.camera_angle === "high_angle") {
      finalCamera = "elevated high-angle overview looking downward across the architectural composition";
    } else if (request.camera_angle === "aerial_birds_eye") {
      finalCamera = "bird's eye aerial drone perspective capturing full site layout, geometry, and contextual landscape";
    } else if (request.camera_angle === "wide_angle") {
      finalCamera = "expansive wide-angle architectural shot (24mm rectilinear lens) with zero barrel distortion";
    } else if (request.camera_angle === "close_up_detail") {
      finalCamera = "shallow depth-of-field close-up detail shot focusing on material junction and craft";
    }
    let finalLighting = lighting;
    if (request.lighting === "custom" && request.custom_lighting?.trim()) {
      finalLighting = request.custom_lighting.trim();
    } else if (request.lighting === "golden_hour") {
      finalLighting = "warm golden-hour late afternoon sunlight with long warm amber shadows and glowing highlights";
      timeOfDay = "Golden hour / late afternoon";
    } else if (request.lighting === "blue_hour") {
      finalLighting = "deep twilight blue-hour ambient illumination with glowing interior warm accent lights";
      timeOfDay = "Blue hour / twilight";
    } else if (request.lighting === "overcast_soft") {
      finalLighting = "soft diffuse northern overcast daylight with gentle shadows and true material colors";
      timeOfDay = "Midday overcast";
    } else if (request.lighting === "bright_sunlight") {
      finalLighting = "crisp direct sunlight with sharp high-contrast shadows and clean highlights";
      timeOfDay = "Midday";
    } else if (request.lighting === "dramatic_night") {
      finalLighting = "dramatic night scene featuring architectural LED uplighting, backlit features, and moody pools of light";
      timeOfDay = "Night";
    } else if (request.lighting === "warm_interior") {
      finalLighting = "warm 2700K ambient interior lighting with layered cove lights, recessed pin spots, and glowing pendants";
      timeOfDay = "Evening";
    } else if (request.lighting === "studio_clean") {
      finalLighting = "high-key clean studio illumination with perfectly balanced softbox fill and zero harsh shadows";
      timeOfDay = "Studio controlled";
    }
    let finalMaterials = materials;
    if (request.materials === "custom" && request.custom_materials?.trim()) {
      finalMaterials = request.custom_materials.trim();
    } else if (request.materials === "warm_wood_stone") {
      finalMaterials = "honed roman travertine stone, quarter-sawn white oak timber, micro-cement plaster, and brushed bronze hardware";
    } else if (request.materials === "concrete_steel") {
      finalMaterials = "smooth board-formed architectural concrete, blackened structural steel, fluted glass, and polished dark slate";
    } else if (request.materials === "marble_brass") {
      finalMaterials = "bookmatched calacatta marble, polished brass inlays, fluted acoustic walnut, and high-gloss lacquer";
    } else if (request.materials === "stucco_terracotta") {
      finalMaterials = "hand-applied lime-wash stucco, artisanal terracotta pavers, natural linen fabrics, and rustic timber beams";
    } else if (request.materials === "glass_aluminum") {
      finalMaterials = "low-iron ultra-clear curtain wall glazing, anodized dark bronze aluminum panels, and architectural mesh";
    }
    let finalEnvironment = environment;
    if (request.environment === "custom" && request.custom_environment?.trim()) {
      finalEnvironment = request.custom_environment.trim();
    } else if (request.environment === "lush_garden") {
      finalEnvironment = "lush manicured garden with mature olive trees, ornamental grasses, architectural shrubs, and soft landscape lighting";
    } else if (request.environment === "urban_city") {
      finalEnvironment = "bustling metropolitan downtown skyline with surrounding architectural towers and paved city sidewalk";
    } else if (request.environment === "coastal_ocean") {
      finalEnvironment = "breathtaking coastal shoreline with calm turquoise ocean water and distant horizon";
    } else if (request.environment === "mountain_forest") {
      finalEnvironment = "serene alpine mountain ridge surrounded by dense pine trees and misty peaks";
    } else if (request.environment === "desert_oasis") {
      finalEnvironment = "tranquil desert landscape with sculptural native cacti, sand dunes, and warm sunset horizon";
    } else if (request.environment === "studio_neutral") {
      finalEnvironment = "minimalist neutral studio cyclorama background";
    }
    let finalMood = mood;
    if (request.mood === "custom" && request.custom_mood?.trim()) {
      finalMood = request.custom_mood.trim();
    } else if (request.mood === "calm_serene") {
      finalMood = "calm, serene, and tranquil architectural sanctuary";
    } else if (request.mood === "grand_dramatic") {
      finalMood = "grand, dramatic, and awe-inspiring architectural monumentality";
    } else if (request.mood === "intimate_cozy") {
      finalMood = "intimate, warm, cozy, and inviting living ambiance";
    } else if (request.mood === "vibrant_energetic") {
      finalMood = "vibrant, energetic, and active public experience";
    } else if (request.mood === "sophisticated_luxurious") {
      finalMood = "sophisticated, refined, and luxurious high-end elegance";
    }
    const qualityBlock = `QUALITY AND REALISM: Create a professional architectural visualization suitable for presentation by a leading architecture, interior-design or real-estate visualization studio. Use physically believable proportions, realistic material response, accurate texture scale, natural reflections, plausible roughness, realistic illumination, contact shadows and balanced exposure. Materials should look physically real rather than synthetic or uniformly smooth. Maintain believable construction logic, furniture scale and human proportions. Lighting must interact consistently with geometry and materials. The output should resemble premium architectural photography or a professional high-end rendering rather than obvious AI artwork. Avoid excessive HDR, artificial sharpening, oversaturation, plastic materials, warped geometry and implausible architectural details.
Do not create warped architecture, distorted furniture, floating objects, random text, logos or watermarks.`;
    const visStyle = `${styleDesc}, ${finalCamera}, high-end editorial publication standard, crisp 8k details, physically accurate light bounces and contact shadows`;
    let referenceImageDirective = "";
    const totalImages = request.reference_images_count || request.reference_images_metadata?.length || (request.has_reference_image ? 1 : 0);
    if (workflow.slug === "reference-guided") {
      const metaList = request.reference_images_metadata || [];
      const drawings = metaList.filter((m) => m.category === "drawing" || !m.category && (m.label?.toLowerCase().includes("drawing") || m.label?.toLowerCase().includes("floorplan") || m.label?.toLowerCase().includes("elevation") || m.label?.toLowerCase().includes("sketch") || m.id === "1"));
      const references = metaList.filter((m) => m.category === "reference" || !drawings.includes(m));
      let drawingDirectives = "";
      if (drawings.length > 0) {
        drawingDirectives = drawings.map((d, i) => {
          const dType = d.drawingType === "Custom" && d.customDrawingType?.trim() ? d.customDrawingType.trim() : d.drawingType || "Floor Plan";
          const dNotes = d.label?.trim() ? ` (Details: ${d.label.trim()})` : "";
          let typeSpecificRule = "";
          const lowerType = dType.toLowerCase();
          if (lowerType.includes("floor") || lowerType.includes("plan")) {
            typeSpecificRule = `- MANDATE FOR [Image ${d.id || i + 1}] (2D ARCHITECTURAL FLOOR PLAN):
  * The generated rendering MUST 100% RELIGIOUSLY and STRICTLY follow the exact architectural layout, room partitions, exterior/interior wall positions, structural columns, door openings, window placements, and spatial proportions shown in [Image ${d.id || i + 1}].
  * Irrespective of whichever perspective angle or camera position is chosen, the rendered space MUST BE OF THIS EXACT FLOOR PLAN. Do NOT alter, hallucinate, add, remove, or rearrange any walls, rooms, or spatial boundaries from this layout.`;
          } else if (lowerType.includes("elevation") || lowerType.includes("facade")) {
            typeSpecificRule = `- MANDATE FOR [Image ${d.id || i + 1}] (ARCHITECTURAL ELEVATION / FACADE):
  * The generated rendering MUST 100% RELIGIOUSLY and STRICTLY follow the exact vertical proportions, story heights, fenestration pattern, facade rhythm, roofline, and architectural openings shown in [Image ${d.id || i + 1}].`;
          } else if (lowerType.includes("sketch") || lowerType.includes("line")) {
            typeSpecificRule = `- MANDATE FOR [Image ${d.id || i + 1}] (ARCHITECTURAL SKETCH / CONCEPT DRAWING):
  * The generated rendering MUST 100% RELIGIOUSLY follow the exact perspective composition, geometric massing, architectural forms, and structural outlines established in [Image ${d.id || i + 1}].`;
          } else if (lowerType.includes("3d") || lowerType.includes("massing") || lowerType.includes("model")) {
            typeSpecificRule = `- MANDATE FOR [Image ${d.id || i + 1}] (3D MODEL / MASSING SCREENSHOT):
  * The generated rendering MUST PRESERVE 100% of the 3D spatial geometry, volumetric forms, structural scale, and perspective alignment shown in [Image ${d.id || i + 1}].`;
          } else if (lowerType.includes("section")) {
            typeSpecificRule = `- MANDATE FOR [Image ${d.id || i + 1}] (SECTION DRAWING):
  * The generated rendering MUST RELIGIOUSLY follow the vertical floor-to-ceiling heights, slab thicknesses, and spatial relationships shown in [Image ${d.id || i + 1}].`;
          } else {
            typeSpecificRule = `- MANDATE FOR [Image ${d.id || i + 1}] (${dType.toUpperCase()}):
  * The generated rendering MUST RELIGIOUSLY adhere to the exact structural layout, geometry, and spatial boundaries shown in [Image ${d.id || i + 1}].`;
          }
          return `\u25CF [Image ${d.id || i + 1}] -> ARCHITECTURAL DESIGN DRAWING [Type: ${dType}]${dNotes}:
${typeSpecificRule}`;
        }).join("\n\n");
      } else {
        drawingDirectives = `\u25CF [Image 1] -> ARCHITECTURAL DESIGN DRAWING:
- MANDATE: The generated render MUST RELIGIOUSLY follow the exact layout, geometry, wall boundaries, and architectural structure shown in [Image 1]. Irrespective of angle, render this exact floorplan/structure.`;
      }
      let referenceDirectives = "";
      if (references.length > 0) {
        referenceDirectives = references.map((r, i) => {
          const imgIndex = r.id || drawings.length + i + 1;
          const aspects = r.referenceAspects && r.referenceAspects.length > 0 ? r.referenceAspects : ["All (Complete Theme & Mood)"];
          const aspectsStr = aspects.join(", ");
          const rNotes = r.label?.trim() ? ` (Details: ${r.label.trim()})` : "";
          const aspectInstructions = [];
          if (aspects.includes("All (Complete Theme & Mood)") || aspects.includes("Visual Style & Theme")) {
            aspectInstructions.push(`  * VISUAL STYLE & THEME: 100% EXPLICITLY ADOPT the exact architectural style, aesthetic identity, color palette, and visual mood from [Image ${imgIndex}].`);
          }
          if (aspects.includes("All (Complete Theme & Mood)") || aspects.includes("Materials & Textures")) {
            aspectInstructions.push(`  * MATERIALS & TEXTURES: EXTRACT and APPLY the exact physical materials, surface finishes (wood species/grain, stone veining, tile patterns, metal sheen, plaster/concrete texture, fabrics) from [Image ${imgIndex}].`);
          }
          if (aspects.includes("All (Complete Theme & Mood)") || aspects.includes("Lighting & Atmosphere")) {
            aspectInstructions.push(`  * LIGHTING & ATMOSPHERE: EXTRACT and REPLICATE the exact lighting condition, color temperature (e.g. warm golden hour, diffuse daylight, moody twilight), shadow softness, and ambient illumination from [Image ${imgIndex}].`);
          }
          if (aspects.includes("All (Complete Theme & Mood)") || aspects.includes("Furniture & Decor")) {
            aspectInstructions.push(`  * FURNITURE & DECOR: EXTRACT the furniture models, styling pieces, light fixtures, and decor elements from [Image ${imgIndex}] and place them harmoniously within the spaces established by the Design Drawing.`);
          }
          if (aspects.includes("All (Complete Theme & Mood)") || aspects.includes("Environment & Landscape")) {
            aspectInstructions.push(`  * ENVIRONMENT & LANDSCAPE: EXTRACT the surrounding outdoor landscape, vegetation, terrain, and exterior environment from [Image ${imgIndex}].`);
          }
          return `\u25CF [Image ${imgIndex}] -> VISUAL REFERENCE [Aspects: ${aspectsStr}]${rNotes}:
${aspectInstructions.join("\n")}`;
        }).join("\n\n");
      } else {
        referenceDirectives = `\u25CF Reference Images -> VISUAL STYLE & THEMATIC REFERENCE:
- MANDATE: 100% EXPLICITLY adopt the visual style, material textures, and lighting ambiance from the attached reference images.`;
      }
      referenceImageDirective = `

===================================================================
CRITICAL MULTIMODAL REFERENCE-GUIDED SYNTHESIS MANDATE
===================================================================
You are provided with input images having strict, segregated authorities. You MUST obey their designations religiously without mixing their roles:

--- CHANNEL 1: DESIGN DRAWING (CORE GEOMETRY & LAYOUT AUTHORITY) ---
${drawingDirectives}

--- CHANNEL 2: VISUAL REFERENCES (STYLE, MATERIALS, LIGHTING & MOOD) ---
${referenceDirectives}

--- CROSS-CHANNEL SYNTHESIS RULE ---
- The DESIGN DRAWING is the absolute authority for spatial layout, room boundaries, walls, and structural geometry.
- The VISUAL REFERENCES are the absolute authority for visual style, materials, lighting, colors, and textures.
- Synthesize them so the final image is an ultra-realistic, professional architectural render depicting the exact structure of Channel 1, finished 100% with the aesthetic theme and materials of Channel 2.`;
    } else if (totalImages > 1) {
      const metaList = request.reference_images_metadata || [];
      const imageDescriptions = Array.from({ length: totalImages }, (_, i) => {
        const meta = metaList[i];
        const label = meta?.label ? ` (${meta.label})` : "";
        const name = meta?.name ? ` [${meta.name}]` : "";
        return `- Image ${i + 1}${label}${name}`;
      }).join("\n");
      referenceImageDirective = `

MULTI-IMAGE ARCHITECTURAL COMPOSITION & ELEMENT SYNTHESIS:
The user has attached ${totalImages} reference images to compose the final visualization:
${imageDescriptions}

INSTRUCTIONS FOR MULTI-IMAGE COMPOSITION:
- Analyze the user prompt to identify which specific architectural features, geometry, furniture models (e.g. sofa, chairs, tables), materials, finishes, lighting, or floorplan layouts should be extracted from each numbered image (Image 1, Image 2, Image 3, etc.).
- Seamlessly integrate the specified elements into one unified, cohesive scene without geometric distortion.
- Harmonize perspective, vanishing points, camera field of view, lighting temperature, and contact shadows across all combined elements.`;
    } else if (request.has_reference_image || totalImages === 1) {
      const cnStrength = request.controlnet_strength !== void 0 ? request.controlnet_strength : 80;
      const cnNote = request.controlnet_enabled ? ` ControlNet conditioning fidelity is set to ${cnStrength}%.` : "";
      if (workflow.slug === "sketch-to-render" || workflow.slug.includes("sketch")) {
        referenceImageDirective = `

REFERENCE IMAGE FIDELITY (SKETCH-TO-RENDER): The attached input image is an architectural sketch. You MUST strictly follow the spatial layout, building massing, roof form, facade outlines, window openings, and perspective lines from the sketch.${cnNote} Render photorealistic materials, lighting, glass reflections, and environmental context onto this exact geometry.`;
      } else if (workflow.slug === "floor-plan-to-3d" || workflow.slug.includes("plan")) {
        referenceImageDirective = `

REFERENCE IMAGE FIDELITY (PLAN-TO-3D): The attached input image is an architectural floor plan / site plan. Accurately translate the exact room partitioning, walls, doors, and openings shown in the plan into an architectural 3D rendering with realistic depth and lighting.${cnNote}`;
      } else if (workflow.slug.includes("clay") || workflow.slug.includes("cad") || workflow.slug.includes("model") || workflow.slug.includes("three-d")) {
        referenceImageDirective = `

REFERENCE IMAGE FIDELITY (MODEL-TO-PHOTOREAL): The attached input image is a 3D massing model. You MUST preserve 100% of the 3D model geometry, perspective angle, and structural volumes.${cnNote} Replace plain/clay surfaces with rich architectural materials, realistic glass, and environmental context.`;
      } else if (workflow.slug.includes("staging") || workflow.slug.includes("redesign") || workflow.slug.includes("renovation")) {
        referenceImageDirective = `

REFERENCE IMAGE FIDELITY (VIRTUAL STAGING / REDESIGN): The attached input image is an interior photograph. Strictly preserve the room boundaries, walls, ceiling, flooring boundary, and windows from the input image while furnishing and styling the space.${cnNote}`;
      } else {
        referenceImageDirective = `

REFERENCE IMAGE FIDELITY: The attached input image is the foundational visual and spatial reference. Follow its overall architectural form, camera angle, perspective, and composition while applying the specified style, lighting, material palette, and environment enhancements.${cnNote}`;
      }
    }
    return `PROJECT: ${fullProjectDescriptor}
DESIGN (ARCHITECTURE, INTERIOR OR LANDSCAPE): ${designDirection}
CONTEXT: ${finalEnvironment}
MATERIAL: ${finalMaterials}
LIGHTING: ${finalLighting} (${timeOfDay})
VIS STYLE: ${visStyle}${referenceImageDirective}

QUALITY AND PHOTOREALISM:
${qualityBlock}`;
  }
  /**
   * Calls Google Cloud Vertex AI (gemini-2.5-flash Text-to-Text API) to produce a context-aware prompt.
   */
  static async enhanceWithVertex(request, getAccessToken) {
    const workflow = WORKFLOWS[request.workflow_id] || WORKFLOWS[1];
    if (workflow.slug === "reference-guided") {
      return this.buildReferenceGuidedPrompt(request);
    }
    const token = await getAccessToken();
    if (!token) {
      return this.enhanceOffline(request);
    }
    const styleKey = request.image_style || "realistic";
    const styleDesc = IMAGE_STYLE_PROMPTS[styleKey] || IMAGE_STYLE_PROMPTS["realistic"];
    const systemInstruction = `You are Google Cloud's expert Architectural Prompt Enhancement AI for Professional Image Generation Workflows.
Your task is to transform any user's architectural request into an impeccably structured, professional-grade prompt following our exact 6-tier architectural schema:

SCHEMA FORMAT TO OUTPUT (OUTPUT ONLY THESE HEADERS IN THIS EXACT ORDER):
PROJECT: <Describe what the project is (e.g. Residential Villa, Boutique Restaurant, Commercial Office Tower, Luxury Resort, Sports Venue) and what the space/view is (e.g. Master Bathroom, Outdoor Infinity Pool, Living Lounge, Facade, Bird's Eye Aerial View)>
DESIGN (ARCHITECTURE, INTERIOR OR LANDSCAPE): <Describe the architectural / interior / landscape design style (e.g. Contemporary Minimalist, Classical Neoclassical, Mid-Century Modern, Japandi, Brutalist, Biophilic Organic, Mediterranean Villa, etc.) with specific design principles>
CONTEXT: <Describe the surrounding environment, site condition, landscape or urban backdrop (e.g. coastal cliffside overlooking ocean, dense urban skyline, lush alpine forest, serene suburban garden)>
MATERIAL: <Describe the detailed physical materials, finishes, and textures (e.g. honed travertine stone, white oak timber, microcement floors, fluted glass, polished brass, fair-faced concrete)>
LIGHTING: <Describe the lighting scheme and atmospheric conditions (e.g. golden hour sunlight with long warm shadows, soft diffuse daylight, dramatic interior architectural LED cove lighting, moody twilight illumination)>
VIS STYLE: <Describe the visual rendering style (e.g. Architectural photography, professional high-end photorealistic rendering, crisp 8k details, balanced exposure, physically accurate reflections and contact shadows)>

QUALITY AND PHOTOREALISM:
Create a professional architectural visualization suitable for presentation by a leading architecture, interior-design or real-estate visualization studio. Use physically believable proportions, realistic material response, accurate texture scale, natural reflections, plausible roughness, realistic illumination, contact shadows and balanced exposure. Maintain believable construction logic, furniture scale and human proportions. Avoid excessive HDR, artificial sharpening, oversaturation, plastic materials, warped geometry and implausible architectural details. Do not create warped architecture, distorted furniture, floating objects, random text, logos or watermarks.

STRICT RULES:
1. Output ONLY the plain text matching the schema above.
2. DO NOT wrap in markdown code fences or backticks (no \`\`\` text).
3. Always include all 6 key sections: PROJECT, DESIGN (ARCHITECTURE, INTERIOR OR LANDSCAPE), CONTEXT, MATERIAL, LIGHTING, VIS STYLE.
4. If Reference-Guided Workflow: The drawing strictly guides the core design\u2014layout, geometry, proportions, openings, and key spatial details\u2014while reference images guide the style, materials, lighting, colors, and overall mood. Instruct the model that the final render must stay faithful to the design drawing while adopting the visual character from the references.
5. If Multiple Reference Images Uploaded: You MUST instruct the generation model to cross-synthesize elements from each numbered image (Image 1, Image 2, Image 3, etc.) exactly as specified by the user's prompt (e.g. placing furniture from Image 2 into the room space of Image 1 while applying materials from Image 3).
6. If Single Reference Image Uploaded: You MUST instruct the generation model to treat the input image as authoritative for geometry, perspective, walls, and composition.
7. Adapt to any user design type or requirement with high architectural fidelity.`;
    const imgCount = request.reference_images_count || request.reference_images_metadata?.length || (request.has_reference_image ? 1 : 0);
    const metaStr = request.reference_images_metadata && request.reference_images_metadata.length > 0 ? request.reference_images_metadata.map((m, idx) => `Image ${idx + 1}: ${m.label || m.name || "Reference"}`).join("; ") : imgCount > 0 ? `${imgCount} Image(s) Attached` : "None";
    const userPrompt = `User Design Prompt: "${request.user_input || workflow.name}"
Workflow: ${workflow.name} (${workflow.slug})
Target Image Model: ${request.model}
Image Style: ${styleKey} (${styleDesc})
Attached Reference Images: ${imgCount > 0 ? "YES" : "NO"} (${metaStr})
ControlNet Conditioning: ${request.controlnet_enabled ? `ON (Fidelity Strength: ${request.controlnet_strength || 80}%)` : "OFF"}
People Option: ${request.people || "none"}
Camera Option: ${request.camera_angle || "auto"} ${request.custom_camera ? `(Custom: ${request.custom_camera})` : ""}
Lighting Option: ${request.lighting || "auto"} ${request.custom_lighting ? `(Custom: ${request.custom_lighting})` : ""}
Materials Option: ${request.materials || "auto"} ${request.custom_materials ? `(Custom: ${request.custom_materials})` : ""}
Environment Option: ${request.environment || "auto"} ${request.custom_environment ? `(Custom: ${request.custom_environment})` : ""}
Mood Option: ${request.mood || "auto"} ${request.custom_mood ? `(Custom: ${request.custom_mood})` : ""}`;
    try {
      const vertexUrl = `https://aiplatform.googleapis.com/v1/projects/rendair-competitor/locations/global/publishers/google/models/gemini-2.5-flash:generateContent`;
      const res = await fetch(vertexUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024
          }
        })
      });
      if (!res.ok) {
        console.warn(`[PromptEnhancer] Vertex call failed (${res.status}), using smart offline fallback`);
        return this.enhanceOffline(request);
      }
      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text || typeof text !== "string") {
        return this.enhanceOffline(request);
      }
      let cleaned = text.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
      }
      return cleaned;
    } catch (err) {
      console.warn("[PromptEnhancer] Error in Vertex AI call:", err);
      return this.enhanceOffline(request);
    }
  }
};

// services/aiRender/backend.ts
import { GoogleAuth } from "google-auth-library";
import path from "path";
import fs from "fs";
var VERTEX_KEY_PATH = path.resolve("ml/auto_plan/rendair_gcp_key.json");
var VERTEX_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
var cachedVertexAuth;
var cachedVertexClientPromise;
var configureVertexEnvironment = () => {
  if (fs.existsSync(VERTEX_KEY_PATH)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = VERTEX_KEY_PATH;
    process.env.GOOGLE_GENAI_USE_VERTEXAI = "true";
    process.env.GOOGLE_CLOUD_PROJECT = "rendair-competitor";
    process.env.GOOGLE_CLOUD_LOCATION = "us-central1";
  }
};
var getVertexAuth = () => {
  if (!fs.existsSync(VERTEX_KEY_PATH)) {
    return null;
  }
  configureVertexEnvironment();
  if (!cachedVertexAuth) {
    cachedVertexAuth = new GoogleAuth({ keyFile: VERTEX_KEY_PATH, scopes: VERTEX_SCOPE });
  }
  return cachedVertexAuth;
};
var getVertexClient = () => {
  const auth = getVertexAuth();
  if (!auth) return null;
  if (!cachedVertexClientPromise) {
    cachedVertexClientPromise = auth.getClient().catch((error) => {
      cachedVertexClientPromise = void 0;
      throw error;
    });
  }
  return cachedVertexClientPromise;
};
function normalizeError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("MIME") || msg.includes("format")) return "UNSUPPORTED_MIME_TYPE";
  if (msg.includes("size") || msg.includes("large")) return "FILE_TOO_LARGE";
  if (msg.includes("401") || msg.includes("auth") || msg.includes("token")) return "AUTHENTICATION_FAILED";
  if (msg.includes("429") || msg.includes("quota") || msg.includes("rate limit")) return "PROVIDER_RATE_LIMIT";
  if (msg.includes("timeout") || msg.includes("deadline")) return "GPU_COLD_START_TIMEOUT";
  if (msg.includes("safety") || msg.includes("block")) return "SAFETY_BLOCKED";
  if (msg.includes("not found") || msg.includes("404")) return "MODEL_UNAVAILABLE";
  return "GENERATION_FAILED";
}
var JOBS_DB = {};
var MOCK_ARCH_IMAGES = [
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
  // Contemporary villa
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
  // Modern kitchen/dining
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
  // Penthouse living room
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80"
  // Luxury bathroom
];
var MOCK_ARCH_VIDEOS = [
  "https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-interior-design-with-creative-lighting-43093-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-bright-kitchen-with-wooden-details-in-modern-house-41577-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-luxury-home-exterior-with-swimming-pool-and-green-lawn-41618-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-living-room-with-modern-furniture-and-large-windows-41574-large.mp4"
];
async function generateVariant(job, workflow, index, isMock) {
  if (isMock || workflow.provider === "local_adjustment" || workflow.provider === "gemini_analysis") {
    const delay = job.model.includes("pro") ? 2500 : 1200;
    await new Promise((r) => setTimeout(r, delay));
    return {
      base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      // 1x1 mock PNG
      usedFallbackMock: true
    };
  }
  try {
    let targetModel = job.model;
    if (!targetModel.startsWith("gemini-")) {
      targetModel = "gemini-3.1-flash-image";
    }
    const client = await getVertexClient();
    const tokenResponse = await client?.getAccessToken();
    const token = tokenResponse?.token;
    const inputImagesList = [];
    const parseImageEntry = (entry, defaultName = "Reference") => {
      if (!entry) return null;
      let rawStr = "";
      let mime = "image/png";
      let label = typeof entry === "object" ? entry.label : "";
      let name = typeof entry === "object" ? entry.name : defaultName;
      let category = typeof entry === "object" ? entry.category : void 0;
      let drawingType = typeof entry === "object" ? entry.drawingType : void 0;
      let customDrawingType = typeof entry === "object" ? entry.customDrawingType : void 0;
      let referenceAspects = typeof entry === "object" ? entry.referenceAspects : void 0;
      if (typeof entry === "string") {
        rawStr = entry;
      } else if (typeof entry === "object") {
        rawStr = entry.base64 || entry.base64Data || entry.signed_url || entry.url || "";
      }
      if (!rawStr || typeof rawStr !== "string" || rawStr.length < 50) return null;
      if (rawStr.startsWith("data:image/")) {
        const match = rawStr.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (match) {
          mime = match[1];
          rawStr = match[2];
        }
      }
      return { mimeType: mime, base64Data: rawStr, label, name, category, drawingType, customDrawingType, referenceAspects };
    };
    const rawMultiImages = job.options?.uploaded_images || job.options?.parameters?.uploaded_images;
    if (Array.isArray(rawMultiImages) && rawMultiImages.length > 0) {
      rawMultiImages.forEach((img, idx) => {
        const parsed = parseImageEntry(img, `Image ${idx + 1}`);
        if (parsed) inputImagesList.push(parsed);
      });
    }
    if (inputImagesList.length === 0) {
      const singleRaw = job.options?.uploaded_image || job.options?.assets?.[0]?.signed_url || job.options?.assets?.[0]?.base64Data || job.options?.source_image;
      const parsedSingle = parseImageEntry(singleRaw, "Image 1");
      if (parsedSingle) inputImagesList.push(parsedSingle);
    }
    const hasInputImage = inputImagesList.length > 0;
    const aspect = (job.options?.parameters?.aspect_ratio === "custom" ? job.options?.parameters?.custom_aspect_ratio : job.options?.parameters?.aspect_ratio) || "16:9";
    const resolution = job.options?.parameters?.resolution || "2K";
    let canvasSpec = `[MANDATORY CANVAS SPECIFICATION]
ASPECT RATIO: ${aspect}
RESOLUTION: ${resolution}`;
    if (hasInputImage) {
      canvasSpec += `
PROPORTION FIDELITY: Maintain 1:1 true physical proportions of all architectural geometry. DO NOT stretch, squish, warp, or skew the scene. If the requested aspect ratio (${aspect}) differs from the input image, seamlessly extend (outpaint) the surrounding landscape, sky, floor, or architectural context to naturally fill the canvas without distorting focal structures.`;
    }
    const finalPrompt = `${job.prompt}

${canvasSpec}`;
    const fetch2 = (await import("node-fetch")).default || global.fetch;
    let base64 = "";
    if (hasInputImage) {
      let targetModel2 = job.model || "gemini-3.1-flash-image";
      if (!targetModel2.startsWith("gemini")) {
        targetModel2 = "gemini-3.1-flash-image";
      }
      const multimodalModels = [targetModel2, "gemini-3.1-flash-image", "gemini-3-pro-image"];
      const client2 = await getVertexClient();
      const token2 = await client2?.getAccessToken().then((r) => r.token);
      for (const m of multimodalModels) {
        if (base64) break;
        try {
          const vertexUrl = `https://aiplatform.googleapis.com/v1/projects/rendair-competitor/locations/global/publishers/google/models/${m}:generateContent`;
          const userParts = [];
          inputImagesList.forEach((img, idx) => {
            let tag = `[Image ${idx + 1}]:`;
            if (img.category === "drawing") {
              const rawType = img.drawingType === "Custom" && img.customDrawingType ? img.customDrawingType : img.drawingType || "Floor Plan";
              let typeName = rawType;
              if (rawType.toLowerCase().includes("floor") || rawType.toLowerCase().includes("plan")) typeName = "Floorplan";
              else if (rawType.toLowerCase().includes("elevation") || rawType.toLowerCase().includes("facade")) typeName = "Elevation";
              else if (rawType.toLowerCase().includes("sketch")) typeName = "Sketch";
              else if (rawType.toLowerCase().includes("3d") || rawType.toLowerCase().includes("model")) typeName = "3D Model Screenshot";
              else if (rawType.toLowerCase().includes("section")) typeName = "Section Drawing";
              tag = `[Image ${idx + 1}: Design Drawing - ${typeName}]:`;
            } else if (img.category === "reference") {
              const aspects = img.referenceAspects && img.referenceAspects.length > 0 ? img.referenceAspects : ["All (Complete Theme & Mood)"];
              let aspectsLabel = "";
              if (aspects.includes("All (Complete Theme & Mood)")) {
                aspectsLabel = "All Theme (Style, Lighting, Materials, Furniture, Landscape)";
              } else {
                aspectsLabel = aspects.map((a) => a.split(" ")[0]).join(", ");
              }
              tag = `[Image ${idx + 1}: Visual Reference - ${aspectsLabel}]:`;
            } else if (img.label) {
              tag = `[Image ${idx + 1}: ${img.label}]:`;
            }
            userParts.push({ text: tag });
            userParts.push({
              inlineData: {
                mimeType: img.mimeType,
                data: img.base64Data
              }
            });
          });
          userParts.push({ text: finalPrompt });
          const res = await fetch2(vertexUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token2}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: userParts
              }],
              generationConfig: {
                candidateCount: 1,
                responseModalities: ["IMAGE"]
              }
            })
          });
          if (res.ok) {
            const data = await res.json();
            const imagePart = data?.candidates?.flatMap((candidate) => candidate.content?.parts || []).find((part) => part.inlineData?.data);
            base64 = imagePart?.inlineData?.data || "";
          } else {
            const errText = await res.text();
            console.warn(`[AI-Render] Gemini multimodal image call (${m}) returned status ${res.status}: ${errText}`);
          }
        } catch (err) {
          console.warn(`[AI-Render] Gemini multimodal image call (${m}) failed: ${err.message}`);
        }
      }
    }
    if (!base64 && !hasInputImage) {
      const imagenModels = [
        "imagen-3.0-generate-002",
        "imagen-3.0-fast-generate-001",
        "imagen-3.0-generate-001"
      ];
      for (const m of imagenModels) {
        if (base64) break;
        try {
          const imagenUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/rendair-competitor/locations/us-central1/publishers/google/models/${m}:predict`;
          const instancePayload = { prompt: finalPrompt };
          const res = await fetch2(imagenUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              instances: [instancePayload],
              parameters: {
                sampleCount: 1,
                aspectRatio: aspect,
                outputOptions: { mimeType: "image/png" }
              }
            })
          });
          if (res.ok) {
            const data = await res.json();
            base64 = data?.predictions?.[0]?.bytesBase64Encoded || "";
          } else {
            const errText = await res.text();
            console.warn(`[AI-Render] Imagen model ${m} returned status ${res.status}: ${errText}`);
          }
        } catch (err) {
          console.warn(`[AI-Render] Imagen model ${m} call failed: ${err.message}`);
        }
      }
    }
    if (!base64) {
      let targetModel2 = job.model;
      if (!targetModel2.startsWith("gemini-")) {
        targetModel2 = "gemini-3.1-flash-image";
      }
      const vertexUrl = `https://aiplatform.googleapis.com/v1/projects/rendair-competitor/locations/global/publishers/google/models/${targetModel2}:generateContent`;
      const userParts = [];
      inputImagesList.forEach((img, idx) => {
        const tag = img.label ? `[REFERENCE IMAGE ${idx + 1} (${img.label})]:` : `[REFERENCE IMAGE ${idx + 1}]:`;
        userParts.push({ text: tag });
        userParts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64Data
          }
        });
      });
      userParts.push({ text: finalPrompt });
      const res = await fetch2(vertexUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: userParts }],
          generationConfig: {
            candidateCount: 1,
            responseModalities: ["IMAGE"]
          }
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Vertex AI API returned status ${res.status}: ${errText}`);
      }
      const data = await res.json();
      const imagePart = data?.candidates?.flatMap((candidate) => candidate.content?.parts || []).find((part) => part.inlineData?.data);
      base64 = imagePart?.inlineData?.data;
    }
    if (!base64) throw new Error("No image bytes returned from Vertex AI.");
    return { base64, usedFallbackMock: false };
  } catch (liveError) {
    console.error(`[AI-Render Job ${job.jobId} Variant ${index + 1}] Live call failed: ${liveError.message}`);
    throw liveError;
  }
}
async function runAsyncJob(jobId) {
  const job = JOBS_DB[jobId];
  if (!job) return;
  const workflow = WORKFLOWS[job.workflowId];
  const startTime = Date.now();
  const variants = job.options?.parameters?.variants || job.options?.variants || job.options?.options?.variants || 1;
  console.log(`[AI-Render Job ${jobId}] Starting execution for workflow: ${workflow.slug} (${workflow.name}) with ${variants} variants in parallel`);
  try {
    job.status = "normalizing";
    console.log(`[AI-Render Job ${jobId}] State: normalizing (AI prompt enhancement)`);
    job.logs?.push("Parsing design intent and enhancing architectural prompt with AI.");
    if (!job.options?.is_custom_edited) {
      try {
        const getAccessToken = async () => {
          const client = await getVertexClient();
          if (!client) return null;
          const res = await client.getAccessToken();
          return res.token || null;
        };
        const enhanced = await PromptEnhancerEngine.enhanceWithVertex({
          user_input: job.options.user_input || "",
          workflow_id: job.workflowId,
          image_style: job.options.image_style || "realistic",
          model: job.model,
          people: job.options.people,
          camera_angle: job.options.camera_angle,
          custom_camera: job.options.custom_camera,
          lighting: job.options.lighting,
          custom_lighting: job.options.custom_lighting,
          materials: job.options.materials,
          custom_materials: job.options.custom_materials,
          environment: job.options.environment,
          custom_environment: job.options.custom_environment,
          mood: job.options.mood,
          custom_mood: job.options.custom_mood,
          has_reference_image: !!job.options.uploaded_image || Array.isArray(job.options.uploaded_images) && job.options.uploaded_images.length > 0,
          reference_images_count: Array.isArray(job.options.uploaded_images) ? job.options.uploaded_images.length : job.options.uploaded_image ? 1 : 0,
          reference_images_metadata: Array.isArray(job.options.uploaded_images) ? job.options.uploaded_images : void 0,
          controlnet_enabled: job.options?.parameters?.controlnet_enabled ?? job.options?.controlnet_enabled,
          controlnet_strength: job.options?.parameters?.controlnet_strength_percent ?? job.options?.controlnet_strength ?? 80
        }, getAccessToken);
        if (enhanced) {
          job.prompt = enhanced;
        }
      } catch (e) {
        console.warn(`[AI-Render Job ${jobId}] AI prompt enhancement fallback:`, e);
      }
    }
    job.status = "preprocessing";
    console.log(`[AI-Render Job ${jobId}] State: preprocessing`);
    job.logs?.push("Validating and converting uploaded source files.");
    await new Promise((r) => setTimeout(r, 600));
    job.status = "generating";
    console.log(`[AI-Render Job ${jobId}] State: generating`);
    job.logs?.push(`Contacting provider adapters and launching ${variants} parallel api calls...`);
    const isMock = !getVertexAuth();
    const results = await Promise.all(
      Array.from({ length: variants }).map((_, idx) => generateVariant(job, workflow, idx, isMock))
    );
    const anyUsedFallback = results.some((r) => r.usedFallbackMock);
    const usedFallbackMock = isMock || anyUsedFallback;
    job.status = "postprocessing";
    console.log(`[AI-Render Job ${jobId}] State: postprocessing`);
    job.logs?.push("Finalizing assets, saving private rendering references.");
    await new Promise((r) => setTimeout(r, 400));
    let mimeType = "image/png";
    let outputType = "image";
    if (workflow.output_types.includes("video/mp4")) {
      outputType = "video";
      mimeType = "video/mp4";
    } else if (workflow.output_types.includes("model/gltf-binary") || workflow.output_types.includes("application/octet-stream")) {
      outputType = "3d";
      mimeType = "model/gltf-binary";
    }
    job.outputs = results.map((res, index) => {
      let signedUrl = `data:${mimeType};base64,${res.base64}`;
      if (outputType === "video") {
        const duration = job.options?.parameters?.duration_seconds || job.options?.duration_seconds || job.options?.options?.duration_seconds || 4;
        const baseVideo = MOCK_ARCH_VIDEOS[index % MOCK_ARCH_VIDEOS.length];
        signedUrl = `${baseVideo}#t=0,${duration}`;
      } else if (outputType === "3d") {
        signedUrl = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Box/GLTF-Binary/Box.glb";
      } else if (isMock || res.usedFallbackMock) {
        const sourceImage = job.options?.assets?.source_image || job.options?.assets?.image;
        if (sourceImage && workflow.slug !== "render-to-moodboard") {
          signedUrl = sourceImage;
        } else if (workflow.slug === "render-to-moodboard") {
          const MOODBOARD_MOCKS = [
            "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1200&q=80"
          ];
          signedUrl = MOODBOARD_MOCKS[index % MOODBOARD_MOCKS.length];
        } else {
          signedUrl = MOCK_ARCH_IMAGES[index % MOCK_ARCH_IMAGES.length];
        }
      }
      return {
        type: outputType,
        mime_type: mimeType,
        gcs_uri: `gs://rendair-competitor-assets/users/dev-user/ai-render/${jobId}/outputs/output_${index}.${mimeType === "image/png" ? "png" : mimeType === "video/mp4" ? "mp4" : "glb"}`,
        signed_url: signedUrl,
        width: 1024,
        height: 1024
      };
    });
    job.status = "completed";
    job.processingTimeMs = Date.now() - startTime;
    job.actualCostUsdEstimate = usedFallbackMock ? 0 : ActualUsageCostCalculator.calculate(job.model, job.processingTimeMs / 1e3 / variants, {
      duration_seconds: job.options?.parameters?.duration_seconds || job.options?.duration_seconds || job.options?.options?.duration_seconds || 4,
      resolution: job.options?.parameters?.resolution || job.options?.resolution || job.options?.options?.resolution || "2K",
      audio: job.options?.parameters?.audio ?? job.options?.audio ?? job.options?.options?.audio ?? false
    }) * variants;
    console.log(`[AI-Render Job ${jobId}] State: completed in ${job.processingTimeMs}ms. Cost: $${job.actualCostUsdEstimate}`);
    job.logs?.push(`Job completed successfully with ${variants} variants.`);
  } catch (err) {
    console.error(`[AI-Render Job ${jobId}] Failed:`, err);
    job.status = "failed";
    job.error = normalizeError(err);
    job.processingTimeMs = Date.now() - startTime;
    job.logs?.push(`Job failed: ${job.error}. Raw: ${err.message || err}`);
    job.actualCostUsdEstimate = 0;
  }
}
var warmAiRenderVertexAuth = async () => {
  const startedAt = Date.now();
  const client = await getVertexClient();
  if (!client) {
    return { ready: false, isMock: true, warmupMs: 0 };
  }
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse?.token) throw new Error("Failed to warm the Google Cloud access token.");
  return { ready: true, warmupMs: Date.now() - startedAt };
};
var routeAiRenderApiRequest = async (request, response) => {
  const url = request.url || "";
  if (!url.startsWith("/api/ai-render")) {
    return false;
  }
  console.log(`[AI-Render API] Request: ${request.method} ${url}`);
  if (url === "/api/ai-render/auth/warm" && request.method === "POST") {
    try {
      const result = await warmAiRenderVertexAuth();
      console.log(`[AI-Render API] Vertex auth prewarmed in ${result.warmupMs}ms`);
      response.json(result);
    } catch (e) {
      console.warn(`[AI-Render API] Vertex auth prewarm failed:`, e);
      response.json({ ready: false, error: e.message });
    }
    return true;
  }
  if (url === "/api/ai-render/workflows" && request.method === "GET") {
    response.json(Object.values(WORKFLOWS));
    return true;
  }
  if (url === "/api/ai-render/enhance-prompt" && request.method === "POST") {
    const body = request.body || {};
    const { user_input, workflow_id, image_style, model } = body;
    const reqPayload = {
      ...body,
      user_input: user_input || "",
      workflow_id: Number(workflow_id || 1),
      image_style: image_style || "realistic",
      model: model || "gemini-3-pro-image"
    };
    try {
      const getAccessToken = async () => {
        const client = await getVertexClient();
        if (!client) return null;
        const res = await client.getAccessToken();
        return res.token || null;
      };
      const enhancedPrompt = await PromptEnhancerEngine.enhanceWithVertex(
        reqPayload,
        getAccessToken
      );
      response.json({ enhanced_prompt: enhancedPrompt });
    } catch (e) {
      console.warn("[AI-Render API] Prompt enhancement error:", e);
      const fallbackPrompt = PromptEnhancerEngine.enhanceOffline(reqPayload);
      response.json({ enhanced_prompt: fallbackPrompt });
    }
    return true;
  }
  if (url === "/api/ai-render/uploads" && request.method === "POST") {
    const { filename, base64Data } = request.body || {};
    response.json({
      gcs_uri: `gs://rendair-competitor-assets/users/dev-user/ai-render/temp-uploads/${filename || "upload.png"}`,
      signed_url: base64Data || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    });
    return true;
  }
  if (url === "/api/ai-render/jobs" && request.method === "POST") {
    const body = request.body || {};
    const { workflow_id, model, user_input, assets, options, parameters, override_prompt } = body;
    const workflow = WORKFLOWS[workflow_id];
    if (!workflow) {
      response.status(400).json({ error: "Invalid workflow_id" });
      return true;
    }
    const effectiveParams = parameters || options || {};
    const selectedModel = model || workflow.default_model;
    const jobId = "job_" + Math.random().toString(36).substr(2, 9);
    const resolvedOverride = override_prompt || options?.override_prompt;
    const compiledPrompt = resolvedOverride || PromptEnhancerEngine.enhanceOffline({
      user_input: user_input || workflow.name,
      workflow_id: workflow.id,
      image_style: body.image_style || options?.image_style || "realistic",
      model: selectedModel
    });
    const variants = effectiveParams?.variants || body.variants || 1;
    const costResult = WorkflowCostEstimator.calculate(workflow_id, selectedModel, effectiveParams);
    const mergedOptions = {
      ...body,
      parameters: effectiveParams,
      options: effectiveParams,
      user_input,
      assets
    };
    const newJob = {
      jobId,
      workflowId: workflow_id,
      status: "queued",
      model: selectedModel,
      options: mergedOptions,
      prompt: compiledPrompt,
      estimatedCostUsd: costResult.estimateUsd * variants,
      actualCostUsdEstimate: 0,
      processingTimeMs: 0,
      outputs: [],
      promptVersion: workflow.prompt_version,
      logs: ["Job created and queued."],
      createdAt: Date.now()
    };
    JOBS_DB[jobId] = newJob;
    void runAsyncJob(jobId);
    response.json(newJob);
    return true;
  }
  const statusMatch = url.match(/^\/api\/ai-render\/jobs\/([^/]+)$/);
  if (statusMatch && request.method === "GET") {
    const jobId = statusMatch[1];
    const job = JOBS_DB[jobId];
    if (!job) {
      response.status(404).json({ error: "Job not found" });
    } else {
      response.json(job);
    }
    return true;
  }
  const resultMatch = url.match(/^\/api\/ai-render\/jobs\/([^/]+)\/result$/);
  if (resultMatch && request.method === "GET") {
    const jobId = resultMatch[1];
    const job = JOBS_DB[jobId];
    if (!job) {
      response.status(404).json({ error: "Job not found" });
    } else {
      response.json({ status: job.status, outputs: job.outputs, error: job.error });
    }
    return true;
  }
  const cancelMatch = url.match(/^\/api\/ai-render\/jobs\/([^/]+)\/cancel$/);
  if (cancelMatch && request.method === "POST") {
    const jobId = cancelMatch[1];
    const job = JOBS_DB[jobId];
    if (!job) {
      response.status(404).json({ error: "Job not found" });
    } else {
      job.status = "cancelled";
      job.logs?.push("Job cancelled by user.");
      response.json(job);
    }
    return true;
  }
  const retryMatch = url.match(/^\/api\/ai-render\/jobs\/([^/]+)\/retry$/);
  if (retryMatch && request.method === "POST") {
    const jobId = retryMatch[1];
    const job = JOBS_DB[jobId];
    if (!job) {
      response.status(404).json({ error: "Job not found" });
    } else {
      job.status = "queued";
      job.logs = ["Job retried."];
      void runAsyncJob(jobId);
      response.json(job);
    }
    return true;
  }
  const rateMatch = url.match(/^\/api\/ai-render\/jobs\/([^/]+)\/rate$/);
  if (rateMatch && request.method === "POST") {
    const jobId = rateMatch[1];
    const { rating } = request.body || {};
    const job = JOBS_DB[jobId];
    if (!job) {
      response.status(404).json({ error: "Job not found" });
    } else {
      job.userRating = rating;
      response.json({ success: true, job });
    }
    return true;
  }
  response.status(404).json({ error: "Not Found" });
  return true;
};

// scripts/testAiRenderRun.ts
async function executeTestSuite() {
  let passedTests = 0;
  let failedTests = 0;
  const testAssert = (condition, message) => {
    if (condition) {
      passedTests++;
      console.log(`[PASS] ${message}`);
    } else {
      failedTests++;
      console.error(`[FAIL] ${message}`);
    }
  };
  try {
    console.log("=== STARTING AI RENDERING PLATFORM TESTS ===\n");
    testAssert(Object.keys(WORKFLOWS).length === 31, "Workflow Registry has exactly 31 workflows");
    testAssert(WORKFLOWS[1].slug === "text-to-render", "Workflow 1 is text-to-render");
    testAssert(WORKFLOWS[30].slug === "image-to-scene", "Workflow 30 is image-to-scene");
    testAssert(WORKFLOWS[31].slug === "reference-guided", "Workflow 31 is reference-guided");
    const rawInput = "Give me an interior render with natural oak floor and warm design";
    const intent = IntentNormalizer.parseFromText(rawInput);
    testAssert(intent.materials.includes("natural oak"), "Intent normalizer extracts materials: natural oak");
    testAssert(intent.interior_style === "warm contemporary minimal", "Intent normalizer resolves styles");
    const resolved = DefaultResolver.resolve(intent);
    testAssert(resolved.lighting === "soft natural daylight", "Default resolver resolves lighting defaults");
    testAssert(resolved.camera_angle === "eye-level architectural photography", "Default resolver resolves camera defaults");
    const workflow = WORKFLOWS[1];
    const compiled = PromptCompiler.compile(workflow, resolved);
    testAssert(compiled.includes("PROJECT: residential interior"), "Prompt compiler matches project layout");
    testAssert(compiled.includes("QUALITY AND REALISM:"), "Prompt compiler injects universal quality block");
    const classicalPrompt = PromptEnhancerEngine.enhanceOffline({ user_input: "Classical interior living hall with wainscoting", workflow_id: 1, image_style: "realistic", model: "gemini-3-pro-image" });
    testAssert(classicalPrompt.toLowerCase().includes("classical architectural style"), "Prompt enhancer detects user classical style override");
    testAssert(classicalPrompt.toLowerCase().includes("carved mahogany"), "Prompt enhancer injects classical materials");
    const highRisePrompt = PromptEnhancerEngine.enhanceOffline({ user_input: "Glass skyscraper high rise building exterior facade", workflow_id: 1, image_style: "realistic", model: "gemini-3-pro-image" });
    testAssert(highRisePrompt.toLowerCase().includes("project:") && highRisePrompt.toLowerCase().includes("commercial"), "Prompt enhancer classifies commercial high-rise exterior");
    testAssert(highRisePrompt.toLowerCase().includes("glass curtain wall"), "Prompt enhancer injects commercial high-rise materials");
    const restaurantPrompt = PromptEnhancerEngine.enhanceOffline({ user_input: "Boutique fine dining restaurant lounge interior", workflow_id: 1, image_style: "realistic", model: "gemini-3-pro-image" });
    testAssert(restaurantPrompt.toLowerCase().includes("project:") && restaurantPrompt.toLowerCase().includes("hospitality"), "Prompt enhancer classifies restaurant hospitality interior");
    const schemaTestPrompt = PromptEnhancerEngine.enhanceOffline({ user_input: "Modern villa with infinity pool and bathroom", workflow_id: 1, image_style: "realistic", model: "gemini-3-pro-image", camera_angle: "custom", custom_camera: "50mm tilt-shift lens from left corner", lighting: "custom", custom_lighting: "3000K warm cove LED strip glow" });
    testAssert(schemaTestPrompt.includes("PROJECT:"), "Prompt enhancer includes PROJECT tier");
    testAssert(schemaTestPrompt.includes("DESIGN (ARCHITECTURE, INTERIOR OR LANDSCAPE):"), "Prompt enhancer includes DESIGN tier");
    testAssert(schemaTestPrompt.includes("CONTEXT:"), "Prompt enhancer includes CONTEXT tier");
    testAssert(schemaTestPrompt.includes("MATERIAL:"), "Prompt enhancer includes MATERIAL tier");
    testAssert(schemaTestPrompt.includes("LIGHTING:"), "Prompt enhancer includes LIGHTING tier");
    testAssert(schemaTestPrompt.includes("VIS STYLE:"), "Prompt enhancer includes VIS STYLE tier");
    testAssert(schemaTestPrompt.includes("50mm tilt-shift lens from left corner"), "Prompt enhancer applies custom camera angle");
    testAssert(schemaTestPrompt.includes("3000K warm cove LED strip glow"), "Prompt enhancer applies custom lighting setup");
    const stadiumPrompt = PromptEnhancerEngine.enhanceOffline({ user_input: "Cricket Stadium", workflow_id: 1, image_style: "realistic", model: "gemini-3-pro-image" });
    testAssert(stadiumPrompt.toLowerCase().includes("sports & athletic venue"), "Prompt enhancer classifies Cricket Stadium as sports venue");
    testAssert(!stadiumPrompt.toLowerCase().includes("residential interior") && !stadiumPrompt.toLowerCase().includes("contemporary living space"), "Prompt enhancer does NOT inject residential defaults into Cricket Stadium");
    const beachPrompt = PromptEnhancerEngine.enhanceOffline({ user_input: "a sandy beach with palm trees", workflow_id: 1, image_style: "realistic", model: "gemini-3-pro-image" });
    testAssert(beachPrompt.toLowerCase().includes("landscape & natural environment") || beachPrompt.toLowerCase().includes("landscape & outdoor architecture"), "Prompt enhancer classifies sandy beach as landscape");
    testAssert(!beachPrompt.toLowerCase().includes("residential interior") && !beachPrompt.toLowerCase().includes("curated contemporary designer furniture"), "Prompt enhancer does NOT inject residential furniture into a beach");
    const cavePrompt = PromptEnhancerEngine.enhanceOffline({ user_input: "inside a limestone cave with stalactites", workflow_id: 1, image_style: "realistic", model: "gemini-3-pro-image" });
    testAssert(!cavePrompt.toLowerCase().includes("curated contemporary designer furniture"), "Prompt enhancer does NOT inject residential furniture into a cave");
    const spacePrompt = PromptEnhancerEngine.enhanceOffline({ user_input: "orbital space station interior corridor", workflow_id: 1, image_style: "realistic", model: "gemini-3-pro-image" });
    testAssert(spacePrompt.toLowerCase().includes("aerospace") || spacePrompt.toLowerCase().includes("orbital"), "Prompt enhancer handles orbital space station safely");
    testAssert(!spacePrompt.toLowerCase().includes("residential interior"), "Prompt enhancer does NOT inject residential interior into a space station");
    const sketchWithImagePrompt = PromptEnhancerEngine.enhanceOffline({ user_input: "Modern residential facade", workflow_id: 2, image_style: "realistic", model: "gemini-3-pro-image", has_reference_image: true, controlnet_enabled: true, controlnet_strength: 85 });
    testAssert(sketchWithImagePrompt.includes("REFERENCE IMAGE FIDELITY (SKETCH-TO-RENDER)"), "Prompt enhancer injects sketch-to-render structural fidelity directive");
    testAssert(sketchWithImagePrompt.includes("85%"), "Prompt enhancer injects ControlNet conditioning fidelity percentage");
    const planWithImagePrompt = PromptEnhancerEngine.enhanceOffline({ user_input: "3 bedroom luxury apartment", workflow_id: 6, image_style: "realistic", model: "gemini-3-pro-image", has_reference_image: true });
    testAssert(planWithImagePrompt.includes("REFERENCE IMAGE FIDELITY (PLAN-TO-3D)"), "Prompt enhancer injects plan-to-3d layout fidelity directive");
    const multiImagePrompt = PromptEnhancerEngine.enhanceOffline({
      user_input: "Take the living room space from Image 1, insert the modern velvet sofa from Image 2 in center, and apply white oak flooring from Image 3",
      workflow_id: 1,
      image_style: "realistic",
      model: "gemini-3-pro-image",
      reference_images_count: 3,
      reference_images_metadata: [
        { id: "1", name: "room_base.png", label: "Living Room Space" },
        { id: "2", name: "sofa_reference.jpg", label: "Velvet Sofa" },
        { id: "3", name: "flooring_swatch.png", label: "White Oak Flooring" }
      ]
    });
    testAssert(multiImagePrompt.includes("MULTI-IMAGE ARCHITECTURAL COMPOSITION & ELEMENT SYNTHESIS"), "Prompt enhancer injects multi-image architectural synthesis directive");
    testAssert(multiImagePrompt.includes("Image 1 (Living Room Space) [room_base.png]"), "Multi-image description includes Image 1 metadata");
    testAssert(multiImagePrompt.includes("Image 2 (Velvet Sofa) [sofa_reference.jpg]"), "Multi-image description includes Image 2 metadata");
    testAssert(multiImagePrompt.includes("Image 3 (White Oak Flooring) [flooring_swatch.png]"), "Multi-image description includes Image 3 metadata");
    const refGuidedPrompt = PromptEnhancerEngine.enhanceOffline({
      user_input: "Render the apartment floor plan using warm modern Scandinavian style from reference",
      workflow_id: 31,
      image_style: "realistic",
      model: "gemini-3-pro-image",
      reference_images_count: 2,
      reference_images_metadata: [
        { id: "1", name: "apartment_floorplan.png", category: "drawing", drawingType: "Floor Plan", label: "Ground Floor Plan Layout" },
        { id: "2", name: "scandinavian_living.jpg", category: "reference", referenceAspects: ["Lighting & Atmosphere", "Materials & Textures"], label: "Scandinavian Style & Lighting" }
      ]
    });
    testAssert(refGuidedPrompt.includes("ARCHITECTURAL LAYOUT & GEOMETRY (Drawing Authority)"), "Prompt enhancer specifies Drawing Authority header");
    testAssert(refGuidedPrompt.includes("VISUAL STYLE, MATERIALS & LIGHTING (Reference Authority)"), "Prompt enhancer specifies Reference Authority header");
    testAssert(refGuidedPrompt.includes("[Image 1: Design Drawing - Floorplan]"), "Prompt enhancer names Drawing with [Image 1: Design Drawing - Floorplan]");
    testAssert(refGuidedPrompt.includes("[Image 2: Visual Reference - Lighting, Materials]"), "Prompt enhancer names Reference with aspects [Image 2: Visual Reference - Lighting, Materials]");
    testAssert(refGuidedPrompt.includes("Produce an architectural/interior rendering following 100% of architectural and interior layout details as per the floorplan"), "Prompt enhancer enforces 100% layout fidelity");
    testAssert(!refGuidedPrompt.includes("PROJECT: Residential"), "Prompt enhancer does NOT inject hallucinated generic 6-tier headers for reference-guided");
    testAssert(isControlNetSupported("flux-2-pro"), "isControlNetSupported returns true for FLUX.2 Pro");
    testAssert(isControlNetSupported("stable-diffusion-xl"), "isControlNetSupported returns true for Stable Diffusion XL");
    testAssert(!isControlNetSupported("flux-1"), "isControlNetSupported returns false for deprecated FLUX.1");
    testAssert(!isControlNetSupported("gemini-3-pro-image"), "isControlNetSupported returns false for Gemini 3 Pro");
    testAssert(!isControlNetSupported("gemini-3.1-flash-image"), "isControlNetSupported returns false for Gemini 3.1 Flash");
    const costPro2K = WorkflowCostEstimator.calculate(1, "gemini-3-pro-image", { resolution: "2K", input_images_count: 1 });
    testAssert(Math.abs(costPro2K.estimateUsd - 0.1375) < 5e-3, `Pro 2K cost estimate is correct: $${costPro2K.estimateUsd} (Expected ~$0.1375)`);
    const costFlash2K = WorkflowCostEstimator.calculate(1, "gemini-3.1-flash-image", { resolution: "2K", input_images_count: 1 });
    testAssert(Math.abs(costFlash2K.estimateUsd - 0.1019) < 5e-3, `Flash 2K cost estimate is correct: $${costFlash2K.estimateUsd} (Expected ~$0.1019)`);
    const costVeo720p = WorkflowCostEstimator.calculate(28, "veo-3.1-lite", { resolution: "720p", duration_seconds: 4, audio: false });
    testAssert(costVeo720p.estimateUsd === 0.12, `Veo 720p 4s video cost is $0.12: $${costVeo720p.estimateUsd}`);
    const costGPUWarm = WorkflowCostEstimator.calculate(2, "flux-2-pro", {});
    testAssert(costGPUWarm.estimateUsd > 0.01 && costGPUWarm.estimateUsd < 0.05, `Flux 2 Pro warm GPU estimate matches bounds: $${costGPUWarm.estimateUsd}`);
    const actualGPU = ActualUsageCostCalculator.calculate("flux-2-pro", 45, {});
    testAssert(Math.abs(actualGPU - 0.0296) < 1e-4, `Actual GPU billed with 30s idle self-termination window: $${actualGPU} (Expected ~$0.02960)`);
    console.log("\nTesting Mock API Route Handlers...");
    let statusCode = 200;
    const mockResponse = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
      },
      payload: null
    };
    const handledList = await routeAiRenderApiRequest({ method: "GET", url: "/api/ai-render/workflows" }, mockResponse);
    testAssert(handledList && statusCode === 200 && mockResponse.payload.length === 31, "Routed GET /api/ai-render/workflows successfully");
    const createReq = {
      method: "POST",
      url: "/api/ai-render/jobs",
      body: {
        workflow_id: 1,
        model: "gemini-3.1-flash-image",
        user_input: "Luxurious dining room",
        options: { resolution: "2K" }
      }
    };
    const handledCreate = await routeAiRenderApiRequest(createReq, mockResponse);
    testAssert(handledCreate && mockResponse.payload.jobId, `Job created successfully: ${mockResponse.payload?.jobId}`);
    const createdJobId = mockResponse.payload?.jobId;
    const handledPoll = await routeAiRenderApiRequest({ method: "GET", url: `/api/ai-render/jobs/${createdJobId}` }, mockResponse);
    const status = mockResponse.payload?.status;
    testAssert(handledPoll && (status === "queued" || status === "normalizing" || status === "preprocessing"), `Job initial state is queued or processing: ${status}`);
    console.log("\n=== TEST RUN COMPLETE ===");
    console.log(`PASSED: ${passedTests}`);
    console.log(`FAILED: ${failedTests}`);
    if (failedTests > 0) {
      process.exit(1);
    } else {
      setTimeout(() => process.exit(0), 50);
    }
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  }
}
executeTestSuite();
