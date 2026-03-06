import { PlaywrightCrawler, Dataset, log } from "crawlee";

const startUrls = [
    "https://www.ycombinator.com/companies"
];

const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 5000,
    headless: true,

    async requestHandler({ page, request, enqueueLinks }) {

        const url = request.url;

        // STEP 1: YC directory page
        if (url.includes("/companies") && !url.match(/\/companies\/[^/]+$/)) {

            log.info("Scraping YC directory...");

            await page.waitForSelector("a[href^='/companies/']");

            await enqueueLinks({
                selector: "a[href^='/companies/']",
                baseUrl: "https://www.ycombinator.com",
                globs: ["https://www.ycombinator.com/companies/*"]
            });

            return;
        }

        // STEP 2: Startup page
        log.info(`Scraping startup page: ${url}`);

        await page.waitForLoadState("networkidle");

        const data = await page.evaluate(() => {

            const company = document.querySelector("h1")?.innerText || "";

            const description =
                document.querySelector("div.text-xl")?.innerText || "";

            const website =
                document.querySelector("a[href^='http']")?.href || "";

            const founders = [];

            document.querySelectorAll("a[href*='linkedin.com']").forEach(el => {

                const founderCard = el.closest("div");

                const name = founderCard?.innerText?.split("\n")[0] || "";

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
            url,
            company: data.company,
            description: data.description,
            website: data.website,
            founders: data.founders
        });
    }
});

await crawler.run(startUrls);
