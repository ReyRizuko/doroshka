package app.dorozhka.music.core.data

import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

@Serializable
data class CatalogTrackResponse(
    val id: String,
    val title: String,
    val artist: String,
    val durationMs: Long = 0,
    val imageUrl: String? = null,
    val audioUrl: String? = null
)

@Serializable
data class StreamResolutionResponse(
    val url: String,
    val downloadAllowed: Boolean = false
)

interface CoreStreamApi {
    @GET("api/v1/search")
    suspend fun search(@Query("q") query: String): List<CatalogTrackResponse>

    @GET("api/v1/trending")
    suspend fun trending(): List<CatalogTrackResponse>

    @GET("api/v1/tracks/{id}/stream")
    suspend fun resolveStream(@Path("id") trackId: String): StreamResolutionResponse
}
