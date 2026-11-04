package app.dorozhka.music.core.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

@Serializable
data class CatalogTrackResponse(
    val id: String,
    val title: String,
    val artist: String,
    @SerialName("duration") val durationSeconds: Double = 0.0,
    @SerialName("cover_url") val imageUrl: String? = null,
    @SerialName("stream_url") val audioUrl: String? = null
)

@Serializable
data class CatalogSearchResponse(
    val items: List<CatalogTrackResponse> = emptyList(),
    val total: Int = 0
)

@Serializable
data class StreamResolutionResponse(
    val url: String,
    val downloadAllowed: Boolean = false
)

interface CoreStreamApi {
    @GET("api/v1/search")
    suspend fun search(
        @Query("q") query: String,
        @Query("limit") limit: Int = 50
    ): CatalogSearchResponse

    @GET("api/v1/search")
    suspend fun trending(
        @Query("q") query: String = "",
        @Query("limit") limit: Int = 40
    ): CatalogSearchResponse

    @GET("api/v1/tracks/{id}/stream-info")
    suspend fun resolveStream(@Path("id") trackId: String): StreamResolutionResponse
}
