import CloudConvert from "cloudconvert";

const apiKey = process.env.CLOUDCONVERT_API_KEY;

export async function convertWithCloudConvert(
  fileBuffer: Buffer,
  fileName: string,
  inputFormat: string,
  outputFormat: string,
  options: Record<string, any> = {}
): Promise<Buffer> {
  if (!apiKey) {
    throw new Error("CLOUDCONVERT_API_KEY environment variable is not defined");
  }

  const cloudConvert = new CloudConvert(apiKey);

  const job = await cloudConvert.jobs.create({
    tasks: {
      "import-file": {
        operation: "import/upload",
      },
      "convert-file": {
        operation: "convert",
        input: "import-file",
        input_format: inputFormat,
        output_format: outputFormat,
        ...options,
      },
      "export-file": {
        operation: "export/url",
        input: "convert-file",
      },
    },
  });

  const uploadTask = job.tasks.find((t) => t.name === "import-file");
  if (!uploadTask) throw new Error("CloudConvert task creation failed");

  await cloudConvert.tasks.upload(uploadTask, fileBuffer, fileName);

  const finishedJob = await cloudConvert.jobs.wait(job.id);

  const exportTask = finishedJob.tasks.find((t) => t.name === "export-file");
  if (!exportTask || exportTask.status !== "finished" || !exportTask.result?.files?.[0]?.url) {
    throw new Error("CloudConvert conversion failed or timed out");
  }

  const fileUrl = exportTask.result.files[0].url;
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to fetch converted file from CloudConvert: ${response.statusText}`);

  return Buffer.from(await response.arrayBuffer());
}

export async function optimizePDFWithCloudConvert(
  fileBuffer: Buffer,
  fileName: string,
  profile: "web" | "print" | "archive" = "web"
): Promise<Buffer> {
  if (!apiKey) {
    throw new Error("CLOUDCONVERT_API_KEY environment variable is not defined");
  }

  const cloudConvert = new CloudConvert(apiKey);

  const job = await cloudConvert.jobs.create({
    tasks: {
      "import-file": {
        operation: "import/upload",
      },
      "optimize-file": {
        operation: "optimize",
        input: "import-file",
        profile: profile,
      },
      "export-file": {
        operation: "export/url",
        input: "optimize-file",
      },
    },
  });

  const uploadTask = job.tasks.find((t) => t.name === "import-file");
  if (!uploadTask) throw new Error("CloudConvert task creation failed");

  await cloudConvert.tasks.upload(uploadTask, fileBuffer, fileName);

  const finishedJob = await cloudConvert.jobs.wait(job.id);

  const exportTask = finishedJob.tasks.find((t) => t.name === "export-file");
  if (!exportTask || exportTask.status !== "finished" || !exportTask.result?.files?.[0]?.url) {
    throw new Error("CloudConvert PDF optimization failed or timed out");
  }

  const fileUrl = exportTask.result.files[0].url;
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to fetch optimized PDF from CloudConvert: ${response.statusText}`);

  return Buffer.from(await response.arrayBuffer());
}
