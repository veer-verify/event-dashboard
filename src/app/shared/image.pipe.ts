import { Pipe, PipeTransform, inject } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { firstValueFrom } from "rxjs";

@Pipe({
  name: "image",
  standalone: true,
  pure: true, 
})
export class ImagePipe implements PipeTransform {
  private http = inject(HttpClient);

  // simple in-memory cache: url -> base64 string
  private static cache = new Map<string, Promise<string | null>>();

  transform(url: string | null | undefined): Promise<string | null> {
    if (!url) return Promise.resolve("assets/image.png");

    if (ImagePipe.cache.has(url)) {
      return ImagePipe.cache.get(url)!;
    }

    const p = this.load(url);
    ImagePipe.cache.set(url, p);
    return p;
  }

  private async load(url: string): Promise<string | null> {
    try {
      const rawUser =
        sessionStorage.getItem("verifai_user") ||
        sessionStorage.getItem("verifai_user");

      let token = "";
      if (rawUser) {
        const user = JSON.parse(rawUser);
        token = user.AccessToken || user.token || "";
      }

      if (!token) {
        token = sessionStorage.getItem("verifai_token") || "";
      }

      const headers = new HttpHeaders({
        Authorization: `Bearer ${token}`,
      });

      const blob = await firstValueFrom(
        this.http.get(url, { headers, responseType: "blob" })
      );

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve("assets/image.png");
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error("Image load failed", err);
      return "assets/image.png"; // Fallback on error to stop spinner
    }
  }
}
