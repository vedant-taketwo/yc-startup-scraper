import { PlaywrightCrawler, Dataset, log, RequestQueue } from "crawlee";

const startUrl = "https://www.ycombinator.com/companies";

const requestQueue = await RequestQueue.open();
await requestQueue.addRequest({ url: startUrl, label: "LIST" });

const crawler = new PlaywrightCrawler({
    requestQueue,
    maxRequestsPerCrawl: 5000,
    headless: true,

    async requestHandler({ page, request, enqueueLinks }) {

        if (request.label === "LIST") {

            log.info("Loading YC companies list...");

            await page.waitForLoadState("networkidle");

            // scroll to load dynamic startups
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 500;

                    const timer = setInterval(() => {
                        window.scrollBy(0, distance);
                        totalHeight += distance;

                        if (totalHeight >= document.body.scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 200);
                });
            });

            await enqueueLinks({
                selector: "a[href^='/companies/']",
                baseUrl: "https://www.ycombinator.com",
                label: "DETAIL",
            });

            return;
        }

        if (request.label === "DETAIL") {

            log.info(`Scraping ${request.url}`);

            await page.waitForLoadState("networkidle");

            const data = await page.evaluate(() => {

                const company =
                    document.querySelector("h1")?.innerText || "";

                const description =
                    document.querySelector("div.text-xl")?.innerText || "";

                const website =
                    document.querySelector("a[href^='http']")?.href || "";

                const founders = [];

                document.querySelectorAll("a[href*='linkedin.com']").forEach(el => {

                    const parent = el.closest("div");

                    const name = parent?.innerText?.split("\n")[0] || "";

                    founders.push({
                        name,
                        linkedin: el.href
                    });
                });

                return {
                    company,
                    description,
                    website,
                    founders
                };
            });

            await Dataset.pushData({
                url: request.url,
                ...data
            });
        }
    }
});

await crawler.run();
